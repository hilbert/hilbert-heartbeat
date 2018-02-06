/*
 *    Copyright 2016 Christian Stussak
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
 (function() {
    //begin private closure

    // Libraries and classes in JS: http://frugalcoder.us/post/2010/02/11/js-classes.aspx
    // Static members are denoted by a leading '_'.
    // The documentation is supposed to be JSDOC 3.
    // Online JSDOC generator: http://jsdoc.sanstv.ru/

    // BEGIN - private static members
    var _initCommand = 'hb_init';
    var _pingCommand = 'hb_ping';
    var _doneCommand = 'hb_done';

    var _defaultUrl = '//localhost:8888';
    var _defaultAppId = 'browser_app';

    /**
     * Get URL parameter.
     * @private
     * @static
     * @see https://stackoverflow.com/questions/11582512/how-to-get-url-parameters-with-javascript/11582513
     */
    function _getUrlParameter(name) {
        return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
    }
    var _passedUrl = _getUrlParameter('HB_URL');
    var _passedAppId = _getUrlParameter('HB_APP_ID');
    // END - private static members

    /**
     * This callback is used to log debug messages.
     * @callback Heartbeat~debugLog
     * @param {String} message
     */

    // BEGIN - constructor
    /**
     * Creates an instance of the Heartbeat class.
     * @public
     * @class Heartbeat
     * @classdesc This class provides functionality to send regular heartbeat
     *            signals to a HTTP server. Once initialized, there is usually
     *            no need to take further action except for changing the
     *            interval between subsequent heartbeats, see {@link Heartbeat#setInterval}.
     * @param {Object} options - JSON object containing initial heartbeat settings.
     * @param {String} [option.url] - The base URL to use when sending the heartbeat.
     * @param {String} [option.appId] - The application id that is send with each heartbeat.
     * @param {Number} [option.interval=1000] - The interval between two heartbeat pings in milliseconds.
     * @param {Boolean} [option.sendInitCommand=false] - If the heartbeat init command should be send. If true, it will be send on the {@link window.onload} event or immediately if {@link window.onload} has already been triggered.
     * @param {Boolean} [option.sendDoneCommand=false] - If the heartbeat done command should be send. If true, it will be send on the {@link window.onunload} event.
     * @param {Heartbeat~debugLog} [option.debugLog=function(msg) {}] Callback function for debug messages.
     * @example
     * // Init and use internal defaults.
     * var heartbeat = new Heartbeat({});
     * @example
     * // Init and properly set base URL and application id with partial fallback.
     * var heartbeat = new Heartbeat({
     *     url: Heartbeat.getPassedUrl(),
     *     appId: Heartbeat.getPassedAppId('test_app')
     * });
     * @example
     * // Full initialization.
     * var heartbeat = new Heartbeat({
     *     url: Heartbeat.getPassedUrl('//localhost:8881'),
     *     appId: Heartbeat.getPassedAppId('test_app'),
     *     interval: 5000,
     *     sendInitCommand: true,
     *     sendDoneCommand: true,
     *     debugLog: function(msg) {
     *         console.log(msg);
     *     }
     * });
     */
    this.Heartbeat = function(options) {
        //if the function is called directly, return an instance of Heartbeat

        if (!(this instanceof Heartbeat))
            return new Heartbeat(options);

        that = this;

        that.url = _defaultUrl;
        that.appId = _defaultAppId;
        that.interval = 5000;
        that.currentHbXhr = new XMLHttpRequest();
        that.debug = false;
        that.timeout = null;
        that.ping = null;
        that.debugLog = function() {};

        //handle the options initialization here
        if (options.hasOwnProperty("debugLog")) {
            that.debugLog = options.debugLog;
        }
        if (options.hasOwnProperty("url")) {
            that.url = options.url;
        }
        if (options.hasOwnProperty("appId")) {
            that.appId = options.appId;
        }
        if (options.hasOwnProperty("interval")) {
            that.interval = options.interval;
        }
        if (options.hasOwnProperty("sendDoneCommand") && options.sendDoneCommand) {
            window.addEventListener("unload", () => that.sendDone(), false);
        }
        
        var _createHeartbeatUrl = function(command, interval) {
            return that.url + "/" + command + "?" + (interval/1000.0) + "&appid=" + that.appId + "&cache_buster=" + new Date().getTime();
        }
        
        /**
         * Generic method for sending heartbeat commands to a heartbeat server.
         * The request will be send asynchronous, i.e. the method will return
         * almost immediately, but the callback will be called a some point in
         * the future.
         * @public
         * @param {String} command - The heartbeat command to be send.
         * @param {Number} interval - The interval in ms the heartbeat server has
         *                            to expect between this and the next heartbeat
         *                            command.
         * @returns {XMLHttpRequest}
         * @param {Heartbeat~sendCallback} callback - Function to be called upon
         *                                            success or failure.
         */
        this.send = function(command, interval, callback) {
            that.debugLog("send heartbeat: " + command );
            var fullUrl = _createHeartbeatUrl(command,interval);
            that.debugLog("REQUEST: " + fullUrl);
            var xhttp = new XMLHttpRequest();
            xhttp.onreadystatechange = function() {
                if (xhttp.readyState == 4) {
                    var err = xhttp.status == 200 ? null : new Error("Request return with: " + xhttp.statusText);
                    if(!err)
                        debugLog("RESPONSE: " + xhttp.responseText);
                    if(typeof callback !== 'undefined' && callback != null)
                        callback(err,xhttp.responseText);
                }
            }
            xhttp.open("GET", fullUrl, true);
            xhttp.send();
            return xhttp;
        }

        /**
         * A callback for the asynchronous send method.
         * @callback Heartbeat~sendCallback
         * @param {Error} error - null in case of success, and Error object otherwise.
         * @param {String} responseMessage The response of the heartbeat server.
         */

         /**
          * Generic method for sending heartbeat commands to a heartbeat server.
          * The request will be send synchronous, i.e. the method will block
          * until the request is finished.
          * @public
          * @param {String} command - The heartbeat command to be send.
          * @param {Number} interval - The interval in ms the heartbeat server has
          *                            to expect between this and the next heartbeat
          *                            command.
          * @returns {String} - The response of the heartbeat server.
          * @throws {Error} - In case the request didn't succeed.
          */
        this.sendSync = function(command, interval) {
            that.debugLog("send heartbeat: " + command );
            var fullUrl = _createHeartbeatUrl(command,interval);
            that.debugLog("REQUEST: " + fullUrl);
            var xhttp = new XMLHttpRequest();
            xhttp.open("GET", fullUrl, false);
            xhttp.send();
            if(xhttp.status !== 200) {
                throw new Error("Request return with: " + xhttp.statusText);
            } else {
                debugLog("RESPONSE: " + xhttp.responseText);
                return xhttp.responseText;
            }
        }

        /**
         * Sends the init command asynchronously using default paramters and
         * without error handling or feedback.
         */
        this.sendInit = function() { that.send( window.Heartbeat.getInitCommand(), that.getInterval() ); }

        /**
         * Sends the ping command asynchronously using default paramters and
         * without error handling or feedback.
         */
        this.sendPing = function() { that.send( window.Heartbeat.getPingCommand(), that.getInterval() ); }

        /**
         * Sends the done command synchronously using default appId, 0ms interval
         * and without error handling or feedback. No further heartbeats will be
         * send after this command unless setInterval() is called again.
         */
        this.sendDone = function() {
            window.clearInterval(that.timeout);

            // Abort current asynchronous heartbeat, if threre is one.
            // Otherwise the currently running heartbeat request may be
            // received by server *after* the synchronous `hb_done` heartbeat,
            // i.e. the heartbeat events seem to be out of order.
            that.currentHbXhr.abort();
            
            that.sendSync( window.Heartbeat.getDoneCommand(), that.getInterval() ); 
        }

        var init = function() {
            that.debugLog("init heartbeat library");
            if (options.hasOwnProperty("sendInitCommand") && options.sendInitCommand)
                that.sendInit();
            that.setInterval(that.interval);
        }
        if (document.readyState !== "loading") {
            init();
        } else {
            window.addEventListener("load", init, false);
        }
    }
    // END - constructor

    // BEGIN - public members
    /**
     * Get the current interval between two heartbeat pings in milliseconds.
     * @public
     * @returns {Number}
     */
    this.Heartbeat.prototype.getInterval = function() {
        return that.interval;
    }

    /**
     * Change the interval between two heartbeat pings.
     * This function sends out a heartbeat ping immediately to satisfy the
     * promise of the previous heartbeat. The next heartbeat will then be send
     * out after the specified number of milliseconds.
     * @public
     * @param {Number} newInterval - Interval between future heartbeat pings.
     */
    this.Heartbeat.prototype.setInterval = function(newInterval) {
        that.debugLog("set heartbeat interval to " + newInterval + "ms");
        window.clearInterval(that.timeout);
        that.interval = newInterval;
        that.sendPing();
        that.timeout = setInterval(that.ping, that.interval);
    }

    /**
     * Get the base URL that is used for each heartbeat command.
     * @public
     * @returns {Number}
     */
    this.Heartbeat.prototype.getUrl = function() {
        return that.url;
    }

    /**
     * Get the application identifier that is send with each heartbet command.
     * @public
     * @returns {String}
     */
    this.Heartbeat.prototype.getAppId = function() {
        return that.appId;
    }

    /**
     * Get the function that is used for debug logging.
     * @public
     * @returns {Heartbeat~debugLog}
     */
    this.Heartbeat.prototype.getDebugLog = function() {
        return that.debugLog;
    }

    /**
     * Set the function that is used for debug logging.
     * @public
     * @param {Heartbeat~debugLog} debugLog
     */
    this.Heartbeat.prototype.setDebugLog = function(debugLog) {
        that.debugLog == debugLog;
    }
    // END - public members

    // BEGIN - public static members
    /**
     * Get the name of the 'init' command.
     * @public
     * @static
     * @returns {String}
     */
    this.Heartbeat.getInitCommand = function() { return _initCommand; }

    /**
     * Get the name of the 'ping' command.
     * @public
     * @static
     * @returns {String}
     */
    this.Heartbeat.getPingCommand = function() { return _pingCommand; }

    /**
     * Get the name of the 'done' command.
     * @public
     * @static
     * @returns {String}
     */
    this.Heartbeat.getDoneCommand = function() { return _doneCommand; }
    
    /**
     * Get the base URL that is passed as URL parameter HB_URL to this site.
     * If HB_URL is not set, {@link fallbackUrl} is used. If {@link fallbackUrl}
     * is not provided, an internal default will be returned.
     * @public
     * @param {String} [fallbackUrl] - Fallback that is used if HB_URL is not set.
     * @returns {String}
     */
    this.Heartbeat.getPassedUrl = function(fallbackUrl) {
        return (_passedUrl == null) ? (typeof fallbackUrl === 'undefined' ? _defaultUrl : fallbackUrl) : _passedUrl;
    }

    /**
     * Get the application id that is passed as URL parameter HB_APP_ID to this site.
     * If HB_APP_ID is not set, {@link fallbackAppId} is used. If {@link fallbackAppId}
     * is not provided, an internal default will be returned.
     * @public
     * @param {String} [fallbackAppId] - Fallback that is used if HB_APP_ID is not set.
     * @returns {String}
     */
    this.Heartbeat.getPassedAppId = function(fallbackAppId) {
        return (_passedAppId == null) ? (typeof fallbackAppId === 'undefined' ? _defaultAppId : fallbackAppId) : _passedAppId;
    }
    // END - public static members

    // end private closure then run the closure, localized to window
    // (this allows to easily encapsulate this class to a namespace if necessary)
}).call(window);
