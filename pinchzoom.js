;(function($,window) {
    var PinchZoom = function(el, options) {
      this.el = $(el);
      this.zoomFactor = 1;
      this.lastScale = 1;
      this.offset = {
        x:0,
        y:0
      };
      this.options = $.extend({}, this.defaults, options || {});
      this.setupMarkup();
      this.bindEvents();
      this.update();
      this.enable();
    };
    PinchZoom.prototype = {
      defaults:{
        tapZoomFactor:1,
        zoomOutFactor:1,
        animationDuration:300,
        animationInterval:5,
        maxZoom:3,
        minZoom:.5,
        lockDragAxis:false,
        use2d:true
      },
      handleDragStart:function(event) {
        this.stopAnimation();
        this.lastDragPosition = false;
        this.hasInteraction = true;
        this.handleDrag(event);
      },
      handleDrag:function(event) {
        if (this.zoomFactor > 1) {
          var touch = this.getTouches(event)[0];
          this.drag(touch, this.lastDragPosition);
          this.offset = this.sanitizeOffset(this.offset);
          this.lastDragPosition = touch;
        }
      },
      handleDragEnd:function(event) {
        this.options.dragEnd && this.options.dragEnd.call(this,event);
        this.end();
      },
      handleZoomStart:function(event) {
        this.stopAnimation();
        this.lastScale = 1;
        this.nthZoom = 0;
        this.lastZoomCenter = false;
        this.hasInteraction = true;
        this.options.zoomStart && this.options.zoomStart(event);
      },
      handleZoom:function(event, newScale) {
        var touchCenter = this.getTouchCenter(this.getTouches(event)), scale = newScale / this.lastScale;
        this.lastScale = newScale;
        this.nthZoom += 1;
        if (this.nthZoom > 3) {
          this.scale(scale, touchCenter);
          this.drag(touchCenter, this.lastZoomCenter);
        }
        this.lastZoomCenter = touchCenter;
      },
      handleZoomEnd:function(event) {
        this.options.zoomEnd && this.options.zoomEnd(event);
        this.end();
      },
      handleDoubleTap:function(event) {
        var center = this.getTouches(event)[0], zoomFactor = this.zoomFactor > 1 ? 1 :this.options.tapZoomFactor, startZoomFactor = this.zoomFactor,
            updateProgress = function(progress) {
              this.scaleTo(startZoomFactor + progress * (zoomFactor - startZoomFactor), center);
            }.bind(this);
        if (this.hasInteraction) {
          return;
        }
        if (startZoomFactor > zoomFactor) {
          center = this.getCurrentZoomCenter();
        }
        this.animate(this.options.animationDuration, this.options.animationInterval, updateProgress, this.swing);
        this.options.doubleTapEnd&&this.options.doubleTapEnd(event);
      },
      sanitizeOffset:function(offset) {
        var maxX = (this.zoomFactor - 1) * this.getContainerX(), maxY = (this.zoomFactor - 1) * this.getContainerY(), maxOffsetX = Math.max(maxX, 0), maxOffsetY = Math.max(maxY, 0), minOffsetX = Math.min(maxX, 0), minOffsetY = Math.min(maxY, 0);
        return {
          x:Math.min(Math.max(offset.x, minOffsetX), maxOffsetX),
          y:Math.min(Math.max(offset.y, minOffsetY), maxOffsetY)
        };
      },
      scaleTo:function(zoomFactor, center) {
        this.scale(zoomFactor / this.zoomFactor, center);
      },
      scale:function(scale, center) {
        scale = this.scaleZoomFactor(scale);
        this.addOffset({
          x:(scale - 1) * (center.x + this.offset.x),
          y:(scale - 1) * (center.y + this.offset.y)
        });
      },
      scaleZoomFactor:function(scale) {
        var originalZoomFactor = this.zoomFactor;
        this.zoomFactor *= scale;
        this.zoomFactor = Math.min(this.options.maxZoom, Math.max(this.zoomFactor, this.options.minZoom));
        return this.zoomFactor / originalZoomFactor;
      },
      drag:function(center, lastCenter) {
        if (lastCenter) {
          if (this.options.lockDragAxis) {
            if (Math.abs(center.x - lastCenter.x) > Math.abs(center.y - lastCenter.y)) {
              this.addOffset({
                x:-(center.x - lastCenter.x),
                y:0
              });
            } else {
              this.addOffset({
                y:-(center.y - lastCenter.y),
                x:0
              });
            }
          } else {
            this.addOffset({
              y:-(center.y - lastCenter.y),
              x:-(center.x - lastCenter.x)
            });
          }
        }
      },
      getTouchCenter:function(touches) {
        return this.getVectorAvg(touches);
      },
      getVectorAvg:function(vectors) {
        var sum = function(a, b) {
          return a + b;
        };
        return {
          x:vectors.map(function(v) {
            return v.x;
          }).reduce(sum) / vectors.length,
          y:vectors.map(function(v) {
            return v.y;
          }).reduce(sum) / vectors.length
        };
      },
      addOffset:function(offset) {
        this.offset = {
          x:this.offset.x + offset.x,
          y:this.offset.y + offset.y
        };
      },
      sanitize:function() {
        if (this.zoomFactor < this.options.zoomOutFactor) {
          this.zoomOutAnimation();
        } else if (this.isInsaneOffset(this.offset)) {
          this.sanitizeOffsetAnimation();
        }
      },
      isInsaneOffset:function(offset) {
        var sanitizedOffset = this.sanitizeOffset(offset);
        return sanitizedOffset.x !== offset.x || sanitizedOffset.y !== offset.y;
      },
      sanitizeOffsetAnimation:function() {
        var targetOffset = this.sanitizeOffset(this.offset), startOffset = {
          x:this.offset.x,
          y:this.offset.y
        }, updateProgress = function(progress) {
          this.offset.x = startOffset.x + progress * (targetOffset.x - startOffset.x);
          this.offset.y = startOffset.y + progress * (targetOffset.y - startOffset.y);
          this.update();
        }.bind(this);
        this.animate(this.options.animationDuration, this.options.animationInterval, updateProgress, this.swing);
      },
      zoomOutAnimation:function(callback) {
        var startZoomFactor = this.zoomFactor, zoomFactor = 1, center = this.getCurrentZoomCenter(), updateProgress = function(progress) {
          this.scaleTo(startZoomFactor + progress * (zoomFactor - startZoomFactor), center);
        }.bind(this);
        this.animate(this.options.animationDuration, this.options.animationInterval, updateProgress, this.swing, !!callback ? callback :null);
      },
      updateAspectRatio:function() {
        this.setContainerY(this.getContainerX() / this.getAspectRatio());
      },
      getInitialZoomFactor:function() {
        return this.container[0].offsetWidth / this.el[0].offsetWidth;
      },
      getAspectRatio:function() {
        return this.el[0].offsetWidth / this.el[0].offsetHeight;
      },
      getCurrentZoomCenter:function() {
        var length = this.container[0].offsetWidth * this.zoomFactor, offsetLeft = this.offset.x, offsetRight = length - offsetLeft - this.container[0].offsetWidth, widthOffsetRatio = offsetLeft / offsetRight, centerX = widthOffsetRatio * this.container[0].offsetWidth / (widthOffsetRatio + 1), height = this.container[0].offsetHeight * this.zoomFactor, offsetTop = this.offset.y, offsetBottom = height - offsetTop - this.container[0].offsetHeight, heightOffsetRatio = offsetTop / offsetBottom, centerY = heightOffsetRatio * this.container[0].offsetHeight / (heightOffsetRatio + 1);
        if (offsetRight === 0) {
          centerX = this.container[0].offsetWidth;
        }
        if (offsetBottom === 0) {
          centerY = this.container[0].offsetHeight;
        }
        return {
          x:centerX,
          y:centerY
        };
      },
      canDrag:function() {
        var isCloseTo = function(value, expected) {
          return value > expected - .01 && value < expected + .01;
        };
        return !isCloseTo(this.zoomFactor, 1);
      },
      getTouches:function(event) {
        var position = this.container.offset();
        return Array.prototype.slice.call(event.touches).map(function(touch) {
          return {
            x:touch.pageX - position.left,
            y:touch.pageY - position.top
          };
        });
      },
      animate:function(duration, interval, framefn, timefn, callback) {
        var startTime = new Date().getTime(), renderFrame = function() {
          if (!this.inAnimation) {
            return;
          }
          var frameTime = new Date().getTime() - startTime, progress = frameTime / duration;
          if (frameTime >= duration) {
            framefn(1);
            if (callback) {
              callback();
            }
            this.update();
            this.stopAnimation();
            this.update();
          } else {
            if (timefn) {
              progress = timefn(progress);
            }
            framefn(progress);
            this.update();
            setTimeout(renderFrame, interval);
          }
        }.bind(this);
        this.inAnimation = true;
        renderFrame();
      },
      stopAnimation:function() {
        this.inAnimation = false;
      },
      swing:function(p) {
        return -Math.cos(p * Math.PI) / 2 + .5;
      },
      getContainerX:function() {
        return this.container[0].offsetWidth;
      },
      getContainerY:function() {
        return this.container[0].offsetHeight;
      },
      setContainerY:function(y) {
        return this.container.height(y);
      },
      setupMarkup:function() {
        this.container = $('<div class="pinch-zoom-container"></div>');
        this.el.before(this.container);
        this.container.append(this.el);
        this.el.css({
          "-webkit-transform-origin":"0% 0%",
          "-moz-transform-origin":"0% 0%",
          "-ms-transform-origin":"0% 0%",
          "-o-transform-origin":"0% 0%",
          "transform-origin":"0% 0%"
        });
      },
      end:function() {
        this.hasInteraction = false;
        this.sanitize();
        this.update();
      },
      bindEvents:function() {
        detectGestures(this.container.get(0), this);
        $(this.el).find("img").on("load", this.update.bind(this));
        this.options.bindClick&&this.options.bindClick.call(this);
      },
      update:function() {
        if (this.updatePlaned) {
          return;
        }
        this.updatePlaned = true;
        setTimeout(function() {
          this.updatePlaned = false;
          var zoomFactor = this.getInitialZoomFactor() * this.zoomFactor, offsetX = -this.offset.x / zoomFactor, offsetY = -this.offset.y / zoomFactor, transform3d = "scale3d(" + zoomFactor + ", " + zoomFactor + ",1) " + "translate3d(" + offsetX + "px," + offsetY + "px,0px)", transform2d = "scale(" + zoomFactor + ", " + zoomFactor + ") " + "translate(" + offsetX + "px," + offsetY + "px)", transition = "transform 0ms ease-out", removeClone = function() {
            if (this.clone) {
              this.clone.remove();
              delete this.clone;
            }
          }.bind(this);
          if (!this.options.use2d || this.hasInteraction || this.inAnimation) {
            this.is3d = true;
            removeClone();
            this.el.css({
              "-webkit-transform":transform3d,
              "-o-transform":transform2d,
              "-ms-transform":transform2d,
              "-moz-transform":transform2d,
              transform:transform3d,
              "-webkit-transition":transition,
              transition:transition
            });
          } else {
            if (this.is3d) {
              this.clone = this.el.clone();
              this.clone.css({
                "pointer-events":"none",
                display:"none"
              });
              this.clone.appendTo(this.container);
              setTimeout(removeClone, 200);
            }
            this.el.css({
              "-webkit-transform":transform2d,
              "-o-transform":transform2d,
              "-ms-transform":transform2d,
              "-moz-transform":transform2d,
              transform:transform3d,
              "-webkit-transition":transition,
              transition:transition
            });
            this.is3d = false;
          }
          this.newestFactor = zoomFactor;
        }.bind(this), 0);
      },
      enable:function() {
        this.enabled = true;
      },
      disable:function() {
        this.enabled = false;
      },
      resize:function(event){
        this.hasInteraction = false;
        this.handleDoubleTap(event);
      }
    };
    /**
     * [detectGestures description]
     * @param  {[type]} el       pinch-zoom-container
     * @param  {[type]} instance 实例
     * @return {[type]}          no return
     */
    var detectGestures = function(el, instance) {
      var interaction = null,
      fingers = 0,
      lastTouchStart = null,
      startTouches = null,
      cannelBubbling = function(e) {
        var e = e || window.event;
        e.cancelBubble = true;
        e.stopPropagation && e.stopPropagation();
      },
      setInteraction = function(newInteraction, event) {
        if (interaction !== newInteraction) {
          if (interaction && !newInteraction) {
            switch (interaction) {
              case "zoom":
              instance.handleZoomEnd(event);
              break;
              case "drag":
              instance.handleDragEnd(event);
              break;
            }
          }
          switch (newInteraction) {
            case "zoom":
            instance.handleZoomStart(event);
            break;
            case "drag":
            instance.handleDragStart(event);
            break;
          }
        }
        interaction = newInteraction;
      },
      updateInteraction = function(event) {
        if (fingers === 2) {
          setInteraction("zoom");
        } else if (fingers === 1 && instance.canDrag()) {
          setInteraction("drag", event);
        } else {
          setInteraction(null, event);
        }
      },
      targetTouches = function(touches) {
        return Array.prototype.slice.call(touches).map(function(touch) {
          return {
            x:touch.pageX,
            y:touch.pageY
          };
        });
      },
      getDistance = function(a, b) {
        var x, y;
        x = a.x - b.x;
        y = a.y - b.y;
        return Math.sqrt(x * x + y * y);
      },
      calculateScale = function(startTouches, endTouches) {
        var startDistance = getDistance(startTouches[0], startTouches[1]), endDistance = getDistance(endTouches[0], endTouches[1]);
        return endDistance / startDistance;
      },
      cancelEvent = function(event) {
        event.stopPropagation();
        event.preventDefault();
      },
      detectDoubleTap = function(event) {
        var time = new Date().getTime();
        if (fingers > 1) {
          lastTouchStart = null;
        }
        if (time - lastTouchStart < 300) {
          cancelEvent(event);
          instance.handleDoubleTap(event);
          switch (interaction) {
            case "zoom":
            instance.handleZoomEnd(event);
            break;
            case "drag":
            instance.handleDragEnd(event);
            break;
          }
        }
        if (fingers === 1) {
          lastTouchStart = time;
        }
      },
      firstMove = true;
      el.addEventListener("touchstart", function(event) {
        instance.options.canZoom && instance.options.canZoom.call(instance,[event]);
        if (instance.canDrag()) {
          cannelBubbling(event);
        }
        if (instance.enabled) {
          firstMove = true;
          fingers = event.touches.length;
          detectDoubleTap(event);
        }
      });
      el.addEventListener("touchmove", function(event) {
        if (instance.canDrag()) {
          cannelBubbling(event);
        }
        if (instance.enabled) {
          if (firstMove) {
            updateInteraction(event);
            if (interaction) {
              cancelEvent(event);
            }
            startTouches = targetTouches(event.touches);
          } else {
            switch (interaction) {
              case "zoom":
              instance.handleZoom(event, calculateScale(startTouches, targetTouches(event.touches)));
              break;
              case "drag":
              instance.handleDrag(event);
              break;
            }
            if (interaction) {
              cancelEvent(event);
              instance.update();
            }
          }
          firstMove = false;
        }
      });
      el.addEventListener("touchend", function(event) {
        if (instance.canDrag()) {
          cannelBubbling(event);
        }
        if (instance.enabled) {
          fingers = event.touches.length;
          updateInteraction(event);
        }
      });
    };
  window.PinchZoom = PinchZoom;
})($,window);
