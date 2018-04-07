// # the following script will detect if iframes are dynamically added to the DOM
// # example - a vimeo video player which does not yet exist in DOM and
// # is added to DOM on action such as click, e.g. using a modal overlay

var vidTrack = (window.vidTrack) ? window.vidTrack : {};

// # function to extract var from the query string by name
function urlParam(url, name) {
    var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(url);
    if (results) return results[1];
}
      
(function($) {
    vidTrack = {
        iframes: [],
        gaTracker: undefined,
        eventMarker: {},

        init: function() {
            // # detect iframes on init
            vidTrack.iframes = document.getElementsByTagName('iframe');

            // # add DOM listner / avoid GTM preview iframe 
            if(vidTrack.iframes.length < 1 || vidTrack.iframes[0].src.indexOf("about:blank") === -1) {
                document.addEventListener("DOMSubtreeModified", function() {
                    // # populate vidTrack.iframes when added to DOM
                    vidTrack.iframes = $('iframe');
                    // # load vidTrack.iframes object into processing function
                    vidTrack.onLoadIframe(vidTrack.iframes);
                }, false);
            }
            // # default load vidTrack.iframes object into processing function
            vidTrack.onLoadIframe(vidTrack.iframes);

            // # Check which version of Google Analytics is used
            if (typeof ga === "function") {
                vidTrack.gaTracker = 'ua'; // Universal Analytics (universal.js)
            }
            if (typeof _gaq !== "undefined" && typeof _gaq.push === "function") {
                vidTrack.gaTracker = 'ga'; // Classic Analytics (ga.js)
            }
            if (typeof dataLayer !== "undefined" && typeof dataLayer.push === "function") {
                vidTrack.gaTracker = 'gtm'; // Google Tag Manager (dataLayer)
            }
      
            // # Listen for messages from the player
            if (window.addEventListener) {
                window.addEventListener('message', vidTrack.onMessageReceived, false);
            } else {
                window.attachEvent('onmessage', vidTrack.onMessageReceived, false);
            }
        },
        // # iFrame processing
        onLoadIframe: function(iframes) {
            // # loop through iframes
            for (var i = 0; i < iframes.length; i++) {

                // # assign the iframe's src to var playerURL
                var playerURL = iframes[i].src;

                // # avoid GTM preview iframe
                if (playerURL.indexOf("about:blank") === -1) {
                    // # ensure the playerURL is a vimeo URL
                    if (playerURL.indexOf("player.vimeo.com") >= 0) {

                        // # extract the player_id value from the query string if exists
                        var iframeId = decodeURIComponent(urlParam(iframes[i].src, 'player_id'));
                        // # extract the api value from the query string if exists
                        var api = decodeURIComponent(urlParam(iframes[i].src, 'api'));
                        // # extract the vimeo ID from the URL
                        var vimeoId = iframes[i].src.match(/player.vimeo.com\/video\/(\d+)/)[1];
console.log('iframeId', iframeId);
                        // # assign the found vimeoId to the iframeId var if iframeId undefined
                        if (iframeId === 'undefined') {
                            iframeId = vimeoId;
                        }

                        // # detect if iframe is missing ID attribute
                        if (!iframes[i].hasAttribute("id")) {
                            // # add missing ID attribute based on vimeoId
                            iframes[i].setAttribute("id", iframeId); 
                        } 
                      
            // # Use with cuation! 
            // # Rewrite all iframe id attr's for vimeo that do not match detected video id
            /*
            if (iframes[i].getAttribute("id") !== vimeoId) {
                            iframes[i].setAttribute("id", iframeId);
                        }
            */

                        // # set the src attribute including the player_id and api query vars
                        if(iframes[i].src.indexOf('api') === -1) { 
                            iframes[i].setAttribute('src', iframes[i].src + (iframes[i].src.indexOf('?') === -1 ? '?' : '&') + 'api=1');
                        }
            if (iframes[i].src.indexOf('player_id') === -1) {
                            iframes[i].setAttribute('src', iframes[i].src + (iframes[i].src.indexOf('?') === -1 ? '?' : '&') + 'player_id=' + iframeId);
                        } 

                        // # build the eventMarker object
                        vidTrack.eventMarker[iframeId] = {
                            'progress25': false,
                            'progress50': false,
                            'progress75': false,
                            'videoPlayed': false,
                            'videoPaused': false,
                            'videoResumed': false,
                            'videoSeeking': false,
                            'videoCompleted': false,
                            'timePercentComplete': 0
                        };
                    }
                }
            }
        },
        // # Message handler for messages received from player
        onMessageReceived: function(e) {
            if (e.origin.replace('https:', 'http:') !== "http://player.vimeo.com" || typeof vidTrack.gaTracker === 'undefined') {
                console.warn('Tracker is missing!');
                return;
            }

            var data = JSON.parse(e.data);
            var iframeEl = $('[data-vimeo="'+data.player_id+'"]');
      console.log('iframeEl', $(iframeEl));
            var iframeId = iframeEl[0].getAttribute("id");
            console.log('iframeIdJSON', iframeId);
            switch (data.event) {

                case 'ready':
                    vidTrack.onReady();
                    break;

                case 'seek':
                    if (!vidTrack.eventMarker[iframeId].videoSeeking) {
                        vidTrack.onSeek(iframeEl);
          
                        // # Avoid subsequent skips (gets set to false during playProgress)
                        vidTrack.eventMarker[iframeId].videoSeeking = true;
                    }
                    break;

                case 'playProgress':
                    // # for autoplaying which doesn't sent initial 'start' event
                    if (!vidTrack.eventMarker[iframeId].videoPlayed) {
                        vidTrack.eventMarker[iframeId].videoPlayed = true;
                    }

                    // # reset seek event marker
                    if (vidTrack.eventMarker[iframeId].videoSeeking) {
                        vidTrack.eventMarker[iframeId].videoSeeking = false;
                    }

                    vidTrack.onPlayProgress(data.data, iframeEl);

                    break;

                case 'play':
                    // # reset finish event marker
                    if (vidTrack.eventMarker[iframeId].videoCompleted) {
                        vidTrack.eventMarker[iframeId].videoCompleted = false;
                    }

                    if (!vidTrack.eventMarker[iframeId].videoPlayed) {
                        vidTrack.sendEvent(iframeEl, 'Started video');

                        // # Track subsequent play trackings
                        // # set to true to avoid subsequent starts
                        vidTrack.eventMarker[iframeId].videoPlayed = true;

                    } else if (!vidTrack.eventMarker[iframeId].videoResumed && vidTrack.eventMarker[iframeId].videoPaused) {
                        vidTrack.sendEvent(iframeEl, 'Resumed video');

                        // # Track subsequent resume trackings // set to true to avoid subsequent resumes
                        vidTrack.eventMarker[iframeId].videoResumed = true;

                        if (vidTrack.eventMarker[iframeId].videoPaused) {
                            vidTrack.eventMarker[iframeId].videoPaused = false;
                        }
                    }
                    break;

                case 'pause':
                    if (!vidTrack.eventMarker[iframeId].videoPaused) {
                        vidTrack.sendEvent(iframeEl, 'Paused video');

                        // # track subsequent pause trackings // set to true to avoid tracking subsequent pause
                        vidTrack.eventMarker[iframeId].videoPaused = true;
                    }

                    if (vidTrack.eventMarker[iframeId].videoResumed) {
                        vidTrack.eventMarker[iframeId].videoResumed = false;
                    }
                    break;

                case 'finish':
                    if (!vidTrack.eventMarker[iframeId].videoCompleted) {

                        // # reset vidTrack.eventMarker object // set videoCompleted to true
                        vidTrack.eventMarker[iframeId] = {
                            'progress25': false,
                            'progress50': false,
                            'progress75': false,
                            'videoPlayed': false,
                            'videoPaused': false,
                            'videoResumed': false,
                            'videoSeeking': false,
                            'videoCompleted': true,
                            'timePercentComplete': 0
                        };

                        if (vidTrack.eventMarker[iframeId].seek) {
                            vidTrack.eventMarker[iframeId].seek = undefined;
                        }

                        vidTrack.sendEvent(iframeEl, 'Completed video');
                    }
                    break;
            }
        },
    // # create the label from various sources
        getLabel: function(iframeEl) {
            var iframeId = iframeEl.attr('id'),
                    label = '', 
            vimeoTitle;

            // # retrieve the video title from Vimeo API.
            $.ajax({
        async: false,
        url: '//vimeo.com/api/oembed.json?url=https://vimeo.com/'+iframeId,
            dataType: 'json',
            success: function(json) {
                vimeoTitle = json.title;
            },        
        error: function (x, y, z) {
            console.log(x[0] + ' - ' + y + ' - ' + ' - ' + z);
        }
            });

            // # look for video title in data-title attribute
            if (iframeEl.data('title') && iframeEl.data('title') !== 'undefined') {
                label += iframeEl.data('title');
        
      // # if data-title attr is null, look for video title in title attribute
            } else if (iframeEl.attr('title') && iframeEl.attr('title') !== 'undefined') {
                label += iframeEl.attr('title');
        
        // # if data-title attr or title attr is null, look for video title in API title property
      } else if(vimeoTitle && vimeoTitle !== 'undefined') {
        label += vimeoTitle;
      
      // # if all of the above are null, fallback to Video ID
            } else {
                label += iframeId;
            }
            return label;
        },

        // # Helper function for sending a message to the player
        post: function(action, value, iframe) {

            // # Source URL without query string
            var playerURL = iframe.src.split("?")[0];

            var data = {
                method: action
            };

            if (value) {
                data.value = value;
            }
            // # send data back to iframe via postMessage();
            iframe.contentWindow.postMessage(JSON.stringify(data), playerURL);
        },
        onReady: function() {
            for (var i = 0; i < vidTrack.iframes.length; i++) {
                // # avoid GTM preview iframe
                if (vidTrack.iframes[i].src.indexOf("about:blank") === -1) {
                    // # ensure the playerURL is a vimeo URL
                    if (vidTrack.iframes[i].src.indexOf("player.vimeo.com") > -1) {
                        vidTrack.post('addEventListener', 'play', vidTrack.iframes[i]);
                        vidTrack.post('addEventListener', 'seek', vidTrack.iframes[i]);
                        vidTrack.post('addEventListener', 'pause', vidTrack.iframes[i]);
                        vidTrack.post('addEventListener', 'finish', vidTrack.iframes[i]);
                        vidTrack.post('addEventListener', 'playProgress', vidTrack.iframes[i]);
                    }
                }
            }
        },

        // # Tracking video progress
        onPlayProgress: function(data, iframeEl) {
            var iframeId = iframeEl.attr('id');
        var progress;

            vidTrack.eventMarker[iframeId].timePercentComplete = Math.round((data.percent) * 100); // Round to a whole number
            var timePercentComplete = vidTrack.eventMarker[iframeId].timePercentComplete;
      
            if (!data) {
                return;
            }

            if (timePercentComplete == 25 && !vidTrack.eventMarker[iframeId].progress25) {
                progress = 'Video marker 25% reached';
                vidTrack.eventMarker[iframeId].progress25 = true;
            }

            if (timePercentComplete == 50 && !vidTrack.eventMarker[iframeId].progress50) {
                progress = 'Video marker 50% reached';
                vidTrack.eventMarker[iframeId].progress50 = true;
            }

            if (timePercentComplete == 75 && !vidTrack.eventMarker[iframeId].progress75) {
                progress = 'Video marker 75% reached';
                vidTrack.eventMarker[iframeId].progress75 = true;
            }

            if (progress) {
                vidTrack.sendEvent(iframeEl, progress);
            }
        },
    
    // # determine if seeked and avoid past play markers
    onSeek: function(iframeEl) {

        var iframeId = iframeEl.attr('id');
      
      var timePercentComplete = vidTrack.eventMarker[iframeId].timePercentComplete;
      
            if (timePercentComplete > 0 && timePercentComplete < 100) {
      
                if (timePercentComplete >= 25) {
                    vidTrack.eventMarker[iframeId].progress25 = true;
                }

                if (timePercentComplete >= 50) {
                    vidTrack.eventMarker[iframeId].progress50 = true;
                }

                if (timePercentComplete >= 75) {
                    vidTrack.eventMarker[iframeId].progress75 = true;
                }

                vidTrack.sendEvent(iframeEl, 'Skipped video to ' + timePercentComplete + '%');
            }
    },
        // # Send event to Classic Analytics, Universal Analytics or Google Tag Manager
        sendEvent: function(iframeEl, action) {

            // # detect NonInteraction
            var nonInteract = true;
            if (action.indexOf('Start') > -1 || action.indexOf('Pause') > -1 || action.indexOf('Stop') > -1 || action.indexOf('Skip') > -1) {
                nonInteract = false;
            }
      
            var label = vidTrack.getLabel(iframeEl);

            switch (vidTrack.gaTracker) {
                case 'gtm':

                    // # reset the array
                    dataLayer.length = 0;
                    dataLayer.push({'event': 'Vimeo',   'eventCategory': 'Vimeo',   'eventAction': label,   'eventLabel': action,   'eventValue': undefined, 'eventNonInteraction': false});
console.log(dataLayer[0]);
                    break;

                case 'ua':
                    ga.length = 0;
                    ga('send', 'event', 'Vimeo', action, label, undefined, {'nonInteraction': false});
                    break;

                case 'ga':
                    _gaq.length = 0;
                    _gaq.push(['_trackEvent', 'Vimeo', action, label, undefined, false]);
                    break;
            }
        }
    };

    vidTrack.init();
})(jQuery);

///////////////////////////////////////////////////////////////////////////////////////////////////
// # test functions to add element to the DOM
// # not to be used in production
function setAttributes(el, attrs) {
  for(var key in attrs) {
    el.setAttribute(key, attrs[key]);
  }
}

function addElement() {
    var div = document.getElementById("playerOne");
    var ifrm = document.createElement("iframe");
    var vimeoId = 140844921;
    var count = 0;
    count++; // # Increment counter     
    
    // # increment the id
    $('iframe').filter('[id]').each(function() { 
        vimeoId = parseInt(this.id) + count;
     });
      
    ifrm.setAttribute("id", vimeoId);
    ifrm.src = 'https://player.vimeo.com/video/'+vimeoId;
    
    setAttributes(ifrm, {
        // # id is set above.
        //'src': '//player.vimeo.com/video/'+vimeoId+'?api=1&autoplay=1&player_id='+vimeoId, 
      //'src': '//player.vimeo.com/video/'+vimeoId+'?api=1&autoplay=1', 
        'width' : '95%',
      'height' : '250',
      //'data-title' : vimeoId,
        'webkitallowfullscreen': '',
      'mozallowfullscreen': '',
      'allowfullscreen': '',
      'allow-popups': ''
    });
        div.appendChild(ifrm);
}
