/* global define, requirejs, TimelineMax, TimelineLite, Power2, Power3 */
define([
    'preloader',
    'globals',
    'classes/stage',
    'debounce',
    'tabulate'
], function (preloader, globals, Stage, debounce, tabulate) {
    'use strict';

    var createjs = requirejs('easel');
    var AUDIO_ICON_WIDTH = 36;
    var AUDIO_ICON_HEIGHT = 36;
    var AUDIO_ICON_SCALE = 0.42;

    /**
     * Creates a new Nameplate instance.
     * @constructor
     * @extends createjs.Container
     */
    function Nameplate(index) {
        /* jshint -W106 */
        this.Container_constructor();
        this.setup(index);
        /* jshint +W106 */
    }

    var p = createjs.extend(Nameplate, createjs.Container);

    p.setup = function(index) {
        var stage = new Stage(0, 0); // Extra height to hit 256x257 minimum for hardware acceleration
        stage.canvas.classList.add('nameplate');

        /* ----- */

        this.cover1 = new createjs.Shape();
        this.cover1.graphics.beginFill('#6fd8ff');
        this.cover1Rect = this.cover1.graphics.drawRect(0, 0, 0, 0).command;

        this.cover2 = new createjs.Shape();
        this.cover2.graphics.beginFill('white');
        this.cover2Rect = this.cover2.graphics.drawRect(0, 0, 0, 0).command;

        /* ----- */

        this.nameText = new createjs.Text('?', '', 'white');
        this.nameText.textBaseline = 'alphabetic';

        /* ----- */

        this.estimateText = new createjs.Text('EST: ?', '', '#afe2f8');

        //Removed Tiwtch Functionality

        this.timeText = new createjs.Text('0:00:00', '900 30px proxima-nova', 'white');
        this.timeText.textBaseline = 'middle';

        /* ----- */

        this.audioIcon = new createjs.Bitmap(preloader.getResult('nameplate-audio-on'));
        this.audioIcon.regX = AUDIO_ICON_WIDTH / 2;
        this.audioIconColorFilter = new createjs.ColorFilter(0,0,0);
        this.audioIcon.visible = false;
        this.audioIcon.scaleX = AUDIO_ICON_SCALE;
        this.audioIcon.scaleY = AUDIO_ICON_SCALE;

        /* ----- */

        this.bottomBorder = new createjs.Shape();
        this.bottomBorderRect = this.bottomBorder.graphics.beginFill('white').drawRect(0, 0, 0, 2).command;

        /* ----- */

        this.background = new createjs.Shape();
        this.backgroundFill = this.background.graphics.beginFill('#00AEEF').command;
        this.backgroundRect = this.background.graphics.drawRect(0, 0, 0, 0).command;

        this.addChild(this.background, this.nameText, this.timeText, this.estimateText, this.audioIcon,/*reomved twitch container*/
            this.bottomBorder, this.cover1, this.cover2);
        stage.addChild(this);

        /* ----- */

        var handleCurrentRunChange = debounce(function(name, stream, estimate) {
            var tl = new TimelineLite();
            var width = this.stage.canvas.width;

            tl.add('enter');

            tl.to(this.cover1Rect, 0.33, {
                w: width,
                ease: Power3.easeInOut,
                onComplete: function() {
                    this.nameText.text = name;
                    this.estimateText.text = 'EST: ' + estimate;

                    this.repositionAudioIcon();

                    //NoTwitch
                }.bind(this)
            }, 'enter');

            tl.to(this.cover2Rect, 0.77, {
                w: width,
                ease: Power3.easeInOut
            }, 'enter');

            tl.add('exit', '-=0.15');

            tl.to(this.cover2Rect, 0.33, {
                x: width,
                ease: Power3.easeInOut
            }, 'exit');

            tl.to(this.cover1Rect, 0.77, {
                x: width,
                ease: Power3.easeInOut
            }, 'exit');

            tl.call(function() {
                this.cover1Rect.x = 0;
                this.cover1Rect.w = 0;
                this.cover2Rect.x = 0;
                this.cover2Rect.w = 0;
            }, [], this);
        }.bind(this), 1000);

        globals.currentRunRep.on('change', function (oldVal, newVal) {
            //kasper: Changed runner to event.
            var event = newVal.runners[index];
            if (event) {
                handleCurrentRunChange(event.name, event.stream, newVal.estimate);
            } else {
                handleCurrentRunChange('?', '', newVal.estimate);
            }
        }.bind(this));

        globals.stopwatchesRep.on('change', function(oldVal, newVal) {
            var stopwatch = newVal[index];
            this.timeText.text = tabulate(stopwatch.time);

            this.timeText.color = 'white';
            this.estimateText.color = '#afe2f8';
            this.backgroundFill.style = '#00AEEF';

            switch (stopwatch.state) {
                case 'paused':
                    this.timeText.color = '#007c9e';
                    break;
                case 'finished':
                    this.backgroundFill.style = '#60bb46';
                    this.estimateText.color = '#b7dcaf';
                    break;
            }
        }.bind(this));

        globals.gameAudioChannelsRep.on('change', function(oldVal, newVal) {
            var channels = newVal[index];
            var canHearSd = !channels.sd.muted && !channels.sd.fadedBelowThreshold;
            var canHearHd = !channels.hd.muted && !channels.hd.fadedBelowThreshold;
            if (canHearSd || canHearHd) {
                if (!this.audioIcon.filters) return;
                this.audioIcon.filters = null;
                this.audioIcon.alpha = 1;
                this.audioIcon.image = preloader.getResult('nameplate-audio-on');
                this.audioIcon.uncache();
            } else {
                if (this.audioIcon.filters && this.audioIcon.filters.length > 0) return;
                this.audioIcon.image = preloader.getResult('nameplate-audio-off');
                this.audioIcon.filters = [this.audioIconColorFilter];
                this.audioIcon.alpha = 0.2;
                this.audioIcon.cache(0, 0, AUDIO_ICON_WIDTH, AUDIO_ICON_HEIGHT);
            }
        }.bind(this));
    };

    p.configure = function(opts) {
        this.stage.canvas.width = opts.width;
        this.stage.canvas.height = (257*257) / opts.width;
        this.stage.canvas.style.top = opts.y + 'px';
        this.stage.canvas.style.left = opts.x + 'px';

        var verticalCenter = opts.height / 2;
        var horizontalMargin = opts.width * 0.015;

        this.alignment = opts.alignment;

        this.backgroundRect.w = opts.width;
        this.backgroundRect.h = opts.height;

        this.timeText.font = '800 ' + opts.timeFontSize + 'px proxima-nova';
        this.timeText.y = verticalCenter;

        this.nameText.font = '900 ' + opts.nameFontSize + 'px proxima-nova';
        this.nameText.y = verticalCenter;
        this.nameText.maxWidth = opts.width - this.timeText.getBounds().width - (horizontalMargin * 2)
            - (opts.width * 0.03);

        var nameTextBounds = this.nameText.getTransformedBounds();
        //Removed twitch

        this.estimateText.font = '800 ' + opts.estimateFontSize + 'px proxima-nova';
        this.estimateText.y = (nameTextBounds.y + nameTextBounds.height) - (opts.nameFontSize * 0.1);

        this.cover1Rect.h = opts.height;
        this.cover2Rect.h = opts.height;

        if (opts.bottomBorder) {
            this.bottomBorder.visible = true;
            this.bottomBorderRect.w = opts.width;
            this.bottomBorder.y = opts.height;
        } else {
            this.bottomBorder.visible = false;
        }

        if (opts.alignment === 'right') {
            this.nameText.x = opts.width - horizontalMargin;
            this.nameText.textAlign = 'right';

            this.estimateText.textAlign = 'right';

            this.timeText.x = horizontalMargin;
            this.timeText.textAlign = 'left';

            this.cover1.scaleX = -1;
            this.cover1.x = opts.width;
            this.cover2.scaleX = -1;
            this.cover2.x = opts.width;
        } else {
            this.nameText.x = horizontalMargin;
            this.nameText.textAlign = 'left';

            this.estimateText.textAlign = 'left';

            this.timeText.x = opts.width - horizontalMargin;
            this.timeText.textAlign = 'right';

            this.cover1.scaleX = 1;
            this.cover1.x = 0;
            this.cover2.scaleX = 1;
            this.cover2.x = 0;
        }

        this.estimateText.x = this.nameText.x;

        if (opts.audioIcon) {
            this.audioIcon.visible = true;
            this.repositionAudioIcon();
        } else {
            this.audioIcon.visible = false;
        }
        
        //Removed twitch
    };

    p.repositionAudioIcon = function() {
        this.audioIcon.y =  this.estimateText.y + 3.5;

        if (this.alignment === 'right') {
            this.audioIcon.x = this.estimateText.x - this.estimateText.getBounds().width - 16;
            this.audioIcon.scaleX = -AUDIO_ICON_SCALE;
        } else {
            this.audioIcon.x = this.estimateText.x + this.estimateText.getBounds().width + 16;
            this.audioIcon.scaleX = AUDIO_ICON_SCALE;
        }
    };


    //Removed tiwtch function

    p.disable = function() {
        this.stage.visible = false;
        this.stage.paused = true;
        this.stage.canvas.style.display = 'none';
    };

    p.enable = function() {
        this.stage.visible = true;
        this.stage.paused = false;
        this.stage.canvas.style.display = 'block';
    };

    return createjs.promote(Nameplate, 'Container');
});
