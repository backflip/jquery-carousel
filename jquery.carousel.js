/*! jQuery Carousel Plugin by Thomas Jaggi (2012) - http://github.com/backflip/jquery-carousel/ */
;(function(window, document, $, undefined){
	"use strict";

	var namespace = 'carousel', // Used for jQuery plugin name, event namespacing, CSS classes
		
		defaults = { // Default settings (see examples if something's not obvious)
			animation: {
				duration: 300,    // milliseconds
				step: 1           // number of slides per animation (might be lower than number of visible slides)
			},
			behavior: {
				horizontal: true, // set to false for vertical slider
				circular: false,  // go to first slide after last one
				autoplay: 0,      // auto-advance interval (0: no autoplay)
				pauseAutoplayOnHover: true,
				keyboardNav: true // enable arrow and [p][n] keys for prev / next actions
			},
			elements: {       // which navigational elements to show
				prevNext: true,   // buttons for previous / next slide
				handles: true,    // button for each slide showing its index
				counter: true     // "Slide x of y"
			},
			events: {         // custom callbacks
				start: false,     // function(currentSlideIndex){ … }
				stop: false       // function(currentSlideIndex){ … }
			},
			initialSlide: 0,  // which slide to show on init
			text: {           // content of navigational elements
				next:    'show next slide',
				prev:    'show previous slide',
				counter: '%current% of %total%',
				handle:  '%index%'
			},
			touch: {          // whether to enable touch support and which criteria to use for swipe movement
				enabled: true,
				thresholds: {
					speed: 0.4,       // multiplied by width of slider per second
					distance: 0.3     // multiplied by width of slider
				}
			},
			visibleSlides: 1  // how many slides to fit within visible area (0: calculate based on initial width)
		},		
		
		utils = {
			// Return supported CSS transition property
			// (based on https://gist.github.com/556448)
			getTransitionProperty: function(){
				var element = document.body || document.documentElement,
					property = 'transition',
					prefixedProperty,
					prefices = ['Moz', 'ms', 'O', 'Webkit'],
					style = element.style;
				
				// Unprefixed
				if (typeof style[property] === 'string') {
					return property;
				}
				
				// Prefixed
				property = property.charAt(0).toUpperCase() + property.substr(1);
				for (var i = 0; i < prefices.length; i++) {
					prefixedProperty = prefices[i] + property;
					if (typeof style[prefixedProperty] === 'string') {
						return prefixedProperty;
					}
				}
				
				// Not supported
				return false;
			},
			
			// Return supported CSS transitionEnd property
			getTransitionEndEvent: function(){
				var property = utils.getTransitionProperty(),
					map = {
						'transition':       'transitionend',
						'MozTransition':    'transitionend',
						'msTransition':     'msTransitionEnd',
						'OTransition':      'oTransitionEnd',
						'WebkitTransition': 'webkitTransitionEnd'
					};
				
				return map[property] || false;
			},
			
			// Return namespaced events (e.g. 'click keydown' --> 'click.slider keydown.slider')
			getNamespacedEvents: function(events){
				var arr = events.split(' ');

				for (var i = 0; i < arr.length; i++) {
					arr[i] = arr[i] + '.' + namespace;
				}
				return arr.join(' ');
			},
			
			// Enable "ARIA-enhanced" button
			enableButton: function($element){
				$element
					.removeClass('state-disabled')
					.removeAttr('aria-disabled')
					.attr("tabindex", 0);
			},
			
			// Disable "ARIA-enhanced" button
			disableButton: function($element){
				$element
					.addClass('state-disabled')
					.attr('aria-disabled', true)
					.attr("tabindex", -1);
			}
		},
		
		// Detect browser support for touch events and CSS transition
		support = {
			touch: 'ontouchstart' in window,
			transition: utils.getTransitionProperty() // returns false if not supported
		},
		
		// Namespace events for navigational elements (e.g. prev/next buttons)
		events = utils.getNamespacedEvents(!support.touch ? 'click keydown' : 'touchstart'),
		
		// Detect movements if touch events are supported
		hasMoved = false,
		
		// Number of instances
		instances = 0;


	var Plugin = function(elem, options){
			this.$dom = {
				slider:           $(elem),
				slides:           $(elem).children(),
				container:        $('<div class="' + namespace + '-container" tabindex="0" />'),
				frame:            $('<div class="' + namespace + '-frame" />'),
				navContainer:     $('<div class="' + namespace + '-nav" aria-hidden="true" />'),
				prev:             $('<span class="'+ namespace + '-prev" role="button" tabindex="0" />'),
				next:             $('<span class="'+ namespace + '-next" role="button" tabindex="0" />'),
				counter:          $('<div class="' + namespace + '-counter" aria-hidden="true" />'),
				handlesContainer: $('<div class="' + namespace + '-handles" aria-hidden="true" />'),
				handles:          null, // Initalized later on (this.$dom.handlesContainer.children())
				handle:           $('<span class="'+ namespace + '-handle" role="button" tabindex="0" />')
			};
			
			this.props = {
				current: 0,
				total: 0,
				visible: 0
			};

			this.state = {
				enabled: false,
				animating: false
			};

			this.settings = $.extend(true, {}, options, this.$dom.slider.data(namespace+'-options'));
		};
		

	Plugin.prototype = {
		/**
		 * Public methods
		 */
		
		init: function(){
			var self = this,
				$dom = this.$dom,
				resizeTimeout = null,
				sliderStyles;

			// Already initiated or empty
			if (this.$dom.slider.data(namespace) || this.$dom.slider.length === 0) {
				return this;
			}
			
			// Index of this carousel instance
			this.index = instances++;
			
			// Save settings		
			this.settings = $.extend(true, {}, defaults, this.settings);

			// Save initial styles to data attribute
			sliderStyles = this._getStyles($dom.slider);
			
			$dom.slider.data(namespace + '-css', sliderStyles);
			$dom.slides.each(function(){
				var $this = $(this),
					styles = self._getStyles($this);

				$this.data(namespace + '-css', styles);
			});
			
			// Wrap slider with containers
			$dom.container.insertBefore($dom.slider);
			$dom.frame.appendTo($dom.container).append($dom.slider.addClass(namespace + '-slider'));

			// Add prev / next link
			if (this.settings.elements.prevNext) {
				$dom.prev.appendTo($dom.navContainer).text(this.settings.text.prev);
				$dom.next.appendTo($dom.navContainer).text(this.settings.text.next);
				
				$dom.navContainer.appendTo($dom.container);
				
				$dom.nav = $dom.prev.add($dom.next);
			}
			
			// Add counter ("slide x of y")
			if (this.settings.elements.counter) {
				$dom.counter.appendTo($dom.container);
			}
			
			// Add handle container
			if (this.settings.elements.handles) {
				$dom.handlesContainer.appendTo($dom.container);
			}

			// Init slides
			$dom.slides.addClass(namespace + '-slide');
			
			if (this.settings.behavior.circular) {
				$dom.slides.each(function(i){
					$(this).data(namespace + '-index', i);
				});
			}
			
			if (!this.settings.behavior.horizontal) {
				$dom.container.addClass(namespace + '-vertical');
			}
			
			this.update();
			
			// Re-calculate dimensions on window resize
			$(window).on(utils.getNamespacedEvents('resize') + this.index, $.proxy(function(){
				if (resizeTimeout) {
					clearTimeout(resizeTimeout);
				}

				resizeTimeout = setTimeout($.proxy(function(){
					this.resize();
				}, this), 100);
			}, this));
			
			// Save instance to data attribute
			$dom.slider.data(namespace, this);
		
			return this;
		},
				
		update: function(options){
			var self = this;
			
			$.extend(true, this.settings, options);
			
			// Update jQuery slide object
			this.$dom.slides = this.$dom.slides.parent().children();
			
			// Update properties
			this.props.total = this.$dom.slides.length;
			this.props.current = this.settings.initialSlide;
			this.props.visible = this._getVisibleSlides();
			
			// Update jQuery handle object
			if (this.settings.elements.handles) {
				this.$dom.handlesContainer.html(this._getHandles());
				this.$dom.handles = this.$dom.handlesContainer.children();
			}
			
			// Resize elements, disable and re-enable
			this.resize();
			this.disable();
			this.enable();
		},
	
		resize: function(){
			var containerWidth = this.$dom.frame.width(),
				containerHeight,
				slidesWidth = this.settings.behavior.horizontal ? containerWidth / this.props.visible : containerWidth,
				slidesHeight,
				sliderWidth = this.settings.behavior.horizontal ? this.props.total * slidesWidth : slidesWidth;

			// Set new dimensions of items and slider
			this.$dom.slides.width(slidesWidth);
			this.$dom.slider.width(sliderWidth).height('auto');
			
			// Get highest slide and set equal min-height for all slides
			slidesHeight = this._getHighestSlide();
			this.$dom.slides.css('min-height', slidesHeight);
			
			// Set container height based on slides' height
			containerHeight = this.settings.behavior.horizontal ? slidesHeight : this.props.visible * slidesHeight;
			this.$dom.frame.height(containerHeight);

			// Jump to initial position
			this.goTo(this.props.current, true);
		},
				
		enable: function(){		
			var self = this;
			
			if (this.state.enabled || this.props.visible > this.props.total) {
				return;
			}
			
			if (this.settings.elements.prevNext) {
				this.$dom.nav.on(events, function(event){
					var $this = $(this),
						isDisabled = $this.hasClass('state-disabled'),
						dir, target, callback;
					
					if (isDisabled) {
						return;
					}

					dir = $this.is(self.$dom.next) ? 1 : -1;
					target = dir * self.settings.animation.step + self.props.current;
					
					callback = function(){
						self.goTo(target);
					};
					
					self._handleButtonEvents(event, $this, callback);
				});
			}
			
			if (this.settings.elements.handles) {
				this.$dom.handles.on(events, function(event){
					var $this = $(this),
						handleIndex = $this.index(),
						slideIndex = self._getCurrentSlideIndex(handleIndex),
						callback = function(){
							self.goTo(slideIndex);
						};

					self._handleButtonEvents(event, $this, callback);
				});
			}
			
			if (this.settings.touch.enabled && support.touch) {
				this._touchEnable();
			}
			
			if (this.settings.behavior.keyboardNav) {
				this.$dom.container.on(utils.getNamespacedEvents('keydown'), $.proxy(function(event){
					var $target = $(event.target),
						nodeName = $target.get(0).nodeName.toLowerCase(),
						isFormElement = $.inArray(nodeName, ['input', 'textarea']) !== -1,
						success = false;

					if (!(isFormElement || event.metaKey || event.ctrlKey)) {
						var code = event.keyCode || event.which,
							targetIndex, slideIndex;

						// [left arrow] or [p]
						if ($.inArray(code, [37, 80]) !== -1) {
							this.prev();
							this.$dom.prev.focus();
							success = true;
							
						// [right arrow] or [n]
						} else if ($.inArray(code, [39, 78]) !== -1) {
							this.next();
							this.$dom.next.focus();
							success = true;
							
						// number keys
						} else if (47 < code && code < 58) {
							targetIndex = code - 49;
							slideIndex = self._getCurrentSlideIndex(targetIndex);
							
							this.goTo(slideIndex);
							
							if (this.settings.elements.handles) {
								this.$dom.handles.eq(targetIndex).focus();
							}
							
							success = true;
						}
					}

					if (success) {
						this._autoplayDisable();
						event.preventDefault();
					}
				}, this));
			}
			
			if (this.settings.behavior.autoplay) {
				this._autoplayEnable();

				if (this.settings.behavior.pauseAutoplayOnHover) {
					this.$dom.container.on(utils.getNamespacedEvents('mouseenter'), $.proxy(function(event){
						this._autoplayDisable();
					}, this));

					this.$dom.container.on(utils.getNamespacedEvents('mouseleave'), $.proxy(function(event){
						this._autoplayEnable();
					}, this));
				}
			}
			
			this.state.enabled = true;
			
			this._updateNav();
		},
		
		disable: function(args){
			if (!this.state.enabled) {
				return;
			}
			
			if (this.settings.elements.prevNext) {
				this.$dom.nav.off(events);
			}
			
			if (this.settings.elements.handles) {
				this.$dom.handles.off(events);
			}
			
			if (this.settings.touch.enabled && support.touch) {
				this._touchDisable();
			}
			
			if (this.settings.behavior.keyboardNav) {
				this.$dom.container.off(utils.getNamespacedEvents('keydown'));
			}
			
			if (this.settings.behavior.autoplay) {
				this._autoplayDisable();
			}
			
			this.state.enabled = false;
			
			this._updateNav();
		},
		
		goTo: function(i, skipAnimation){
			var self = this,
				index = this._getValidatedTarget(i),
				cssPosition = this._getTargetPosition(index),
				duration = skipAnimation ? 0 : this.settings.animation.duration,
				callback = function(){
					if (self.settings.events.stop) {
						self.settings.events.stop(index);
					}
					self.state.animating = false;
				},
				prop, transitionProp, endEvent, transition, oldTransition;

			if (!skipAnimation) {
				this.state.animating = true;
				
				if (this.settings.events.start) {
					this.settings.events.start(index);
				}
				
				if (!support.transition) {
					this.$dom.slider.animate(cssPosition, duration, function(){
						callback();
					});
				} else {
					prop = support.transition;
					transitionProp = this.settings.behavior.horizontal ? 'left' : 'top';
					endEvent = utils.getNamespacedEvents(utils.getTransitionEndEvent());
					oldTransition = this.$dom.slider.css(prop);
					transition = transitionProp + ' ' + duration/1000 + 's ease-in-out';
					
					this.$dom.slider.css(prop, transition);
					this.$dom.slider.css(cssPosition);
	
					this.$dom.slider.on(endEvent, function(){
						self.$dom.slider.off(endEvent);
						self.$dom.slider.css(prop, oldTransition);
						
						callback();
					});
				}
			} else {
				this.$dom.slider.css(cssPosition);
			}
			
			this.props.current = index;
			
			this._updateNav();
		},
		next: function(){
			this.goTo(this.props.current + this.settings.animation.step);
		},
		prev: function(){
			this.goTo(this.props.current - this.settings.animation.step);
		},
		
		destroy: function(){
			var $dom = this.$dom,
				sliderStyles = $dom.slider.data(namespace + '-css');
			
			$dom.slider
				.removeClass(namespace + '-slider')
				.removeData(namespace)
				.removeData(namespace + '-css')
				.insertAfter($dom.container)
				.css(sliderStyles);
				
			$dom.slides
				.removeClass(namespace + '-slide')
				.removeData(namespace + '-index')
				.each(function(){
					var $this = $(this),
						styles = $this.data(namespace + '-css');

					$this.css(styles);
				})
				.removeData(namespace + '-css');
					
			$dom.container.remove();
			
			this.state.enabled = false;
			this.props.current = 0;
			
			$(window).off(utils.getNamespacedEvents('resize') + this.index);
		},
		
		
		/**
		 * Pseudo-private helper functions
		 */

		_autoplayEnable: function(){
			this.autoplay = setInterval($.proxy(function(){
				this.next();
			}, this), this.settings.behavior.autoplay);
		},
		
		// Clear autoplay interval 
		_autoplayDisable: function(){
			clearInterval(this.autoplay);
			this.autoplay = null;
		},
		 
		// Criteria for keyboard and touch events on buttons
		_handleButtonEvents: function(event, $target, callback){
			switch (event.type) {
				case 'keydown':
					if (!(event.metaKey || event.ctrlKey)) {
						var code = event.keyCode || event.which;
		
						// Space or enter key
						if ($.inArray(code, [13, 32]) !== -1) {
							callback();
							event.preventDefault();
						}
					}
					
					break;
					
				case 'touchstart':
					hasMoved = false;

					$target.on('touchmove.' + namespace, function(){
						hasMoved = true;
					});
					$target.on('touchend.' + namespace, function(){
						$target.off('touchmove.' + namespace);
						$target.off('touchend.' + namespace);
						
						if (!hasMoved) {
							callback();
						}
					});
					
					break;
				
				default:
					callback();
					break;
			}
			
			if (this.settings.behavior.autoplay) {
				this._autoplayDisable();
			}
		},
		
		// Return a group of handles (one for each slide)
		_getHandles: function(){
			var fragment = document.createDocumentFragment();
			
			for (var i = 0; i < this.props.total; i++) {
//				var handle = document.createElement('span');
//
//				handle.className = namespace + '-handle';
//				handle.innerHTML = this.settings.text.handle.replace('%index%', (i+1));
//				handle.setAttribute('role', 'button');
//				handle.setAttribute('tabindex', 0);
				
				var text = this.settings.text.handle.replace('%index%', (i+1)),
					handle = this.$dom.handle.clone().text(text).get(0);
				
				fragment.appendChild(handle);
			}
			
			return $(fragment); 
		},
		
		// Return maximal height of slides
		_getHighestSlide: function(){
			var height = 0;
			
			this.$dom.slides.each(function(){
				var slideHeight = $(this).css('min-height', 0).height();

				if (slideHeight > height) {
					height = slideHeight;
				}
			});
			
			return height;
		},
		
		// Return original slide index (in circular mode, slides change their index)
		_getOriginalSlideIndex: function(currentIndex){
			var index = currentIndex;

			if (this.settings.behavior.circular) {
				index = this.$dom.slides.eq(currentIndex).data(namespace + '-index');
			}

			return index;
		},
		// Return slide position by original index
		_getCurrentSlideIndex: function(originalIndex){
			var index = originalIndex;

			if (this.settings.behavior.circular) {
				this.$dom.slides.each(function(){
					var $this = $(this),
						currentSlideIndex = $this.index(),
						originalSlideIndex = $this.data(namespace + '-index');

					if (originalIndex === originalSlideIndex) {
						index = currentSlideIndex;
						return false;
					}
				});
			}

			return index;
		},
		
		// Return initial styles (re-applied on destroy)
		// TODO: How to detect "auto"?
		_getStyles: function($element){
			var styles = ['height', 'left', 'min-height', 'top', 'width'],
				selection = {},
				transition;
			
			for (var i = 0; i < styles.length; i++) {
				selection[styles[i]] = $element.css(styles[i]);
			}

			if (support.transition) {
				transition = support.transition.charAt(0).toLowerCase() + support.transition.substr(1);
				selection[transition] = $element.css(transition);
			}

			return selection;
		},
		
		// Return slide position
		_getTargetPosition: function(index){
			var slidesSize = this.settings.behavior.horizontal ? this.$dom.slides.width() : this.$dom.slides.height(),
				prop = this.settings.behavior.horizontal ? 'left' : 'top',
				css = {};
				
			css[prop] = - index * slidesSize;
			
			return css;
		},
		
		// Return target slide index (calls _shiftSlides() if necessary)
		_getValidatedTarget: function(i){
			if (!this.settings.behavior.circular) {
				// Too far left / top
				if (i < 0) {
					i = 0;
				// Too far right / bottom
				} else if (i >= (this.props.total - this.props.visible)) {
					i = this.props.total - this.props.visible;
				}
			} else {
				// Shift slides right / bottom to left / top
				if (i < 0) {
					var minIndex = this.props.total + i;
					
					if (this._shiftSlides(minIndex, -1)) {
						return 0;
					}
				// Shift slides left / top to right / bottom
				} else if (this.props.total > this.props.visible && i > (this.props.total - this.props.visible)) {
					var maxIndex = (i - 1) - (this.props.total - this.props.visible);

					if (this._shiftSlides(maxIndex, 1)) {
						return i - (maxIndex + 1);
					}
				}
			}
			
			return i;
		},
		
		// Calculate number of visible slides if not set
		_getVisibleSlides: function(){
			if (this.settings.visibleSlides > 0) {
				return this.settings.visibleSlides;
			} else {
				var self = this,
					minSize = 0,
					containerSize = this.settings.behavior.horizontal ? this.$dom.frame.width() : this.$dom.frame.height();
				
				this.$dom.slides.each(function(){
					var size = self.settings.behavior.horizontal ? $(this).width() : $(this).height();
					
					if (size > minSize) {
						minSize = size;
					}
				});
				
				return Math.round(containerSize/minSize);
			}
		},
		
		// Shift slides around in circular mode
		_shiftSlides: function(index, dir){
			var selector = (dir === -1) ? ':gt(' + (index-1) + ')' : ':lt(' + (index+1) + ')',
				$slides = this.$dom.slides.filter(selector);
			
			if ($slides.length > 0) {
				var axis = this.settings.behavior.horizontal ? 'left' : 'top',
					slideDimension = this.settings.behavior.horizontal ? this.$dom.slides.width() : this.$dom.slides.height(),
					currentPosition = this.$dom.slider.position(),
					newPosition = {};
					
				newPosition[axis] = currentPosition[axis] + dir * $slides.length * slideDimension;

				if (dir === -1) {
					$slides.prependTo(this.$dom.slider);
				} else {
					$slides.appendTo(this.$dom.slider);
				}
				this.$dom.slides = this.$dom.slider.children();
				this.$dom.slider.css(newPosition);
				
				return true;
			} else {
				return false;
			}
		},
		
		// Bind touch events
		_touchEnable: function(){
			// Based on Mathias Bynens' improved version of jSwipe.js
			// https://gist.github.com/936253
			var self = this,
				
				coords = {
					start: { x: 0, y: 0 },
					end: { x: 0, y: 0 }
				},
				time = {
					start: 0,
					end: 0
				},
				thresholds = {
					distance: self.settings.touch.thresholds.distance * self.$dom.frame.width(),
					speed: self.settings.touch.thresholds.speed * self.$dom.frame.width()
				},
				
				sliderOffset = { top: 0, left: 0 },	
				events = {};
				
					
			function getDistance(){
				var distance = {
						x: coords.end.x - coords.start.x,
						y: coords.end.y - coords.start.y
					};
					
				// Swap coords if slider is vertical
				if (!self.settings.behavior.horizontal) {
					distance = {
						x: distance.y,
						y: distance.x
					};
				}
				
				return distance;
			}

			events['touchstart.'+namespace] = function(e){
				var event = e.originalEvent.targetTouches[0];
			
				coords.start.x = event.pageX;
				coords.start.y = event.pageY;
				
				sliderOffset = self.$dom.slider.position();
				
				time.start = new Date().getTime();
				
				hasMoved = false;
			};
			events['touchmove.'+namespace] = function(e) {
				// TODO: Debounce
			
				var event = e.originalEvent.targetTouches[0],
					distance = 0,
					animProps = {},
					positionProp = self.settings.behavior.horizontal ? 'left' : 'top',
					refDimension;
					
				coords.end.x = event.pageX;
				coords.end.y = event.pageY;
				
				distance = getDistance();

				if (Math.abs(distance.x) > Math.abs(distance.y)) {
					refDimension = self.settings.behavior.horizontal ? sliderOffset.left : sliderOffset.top;
					animProps[positionProp] = refDimension + distance.x;
					
					self.$dom.slider.css(animProps);
					
					hasMoved = true;
					
					e.preventDefault();
				}
			};
			events['touchend.'+namespace] = function(e) {
				if (!hasMoved) {
					return;
				}
				
				var event = e.originalEvent.targetTouches[0],
					distance = getDistance(),
					speed,
					targetSlide = self.props.current;
				
				// Check if swipe direction was correct
				if (Math.abs(distance.x) > Math.abs(distance.y)) {
					time.end = new Date().getTime();
					speed = Math.abs(distance.x)/(time.end - time.start)*1000;
				
					// Check if either swipe distance or speed was sufficient
					if (Math.abs(distance.x) > thresholds.distance || speed > thresholds.speed) {
						var refDimension = self.settings.behavior.horizontal ? self.$dom.slides.width() : self.$dom.slides.height(),
							swipeDir = (distance.x > 0) ? -1 : 1,
							slidesSwiped = Math.abs(Math.round(distance.x / refDimension));
						
						// Short but quick swipe
						if (slidesSwiped < 1 && speed > thresholds.speed) {
							slidesSwiped = 1;
						}

						targetSlide = self.props.current + swipeDir*slidesSwiped;
					} 
				
					self.goTo(targetSlide);
			
					if (self.settings.behavior.autoplay) {
						self._autoplayDisable();
					}
				}
			};
			
			this.$dom.frame.on(events);
		},
		
		// Unbind touch events
		_touchDisable: function(){
			this.$dom.frame.off(utils.getNamespacedEvents('touchstart touchmove touchend'));
		},
		
		// Update navigational elements (enable / disable buttons, set class "state-current")
		// TODO: called twice on init
		_updateNav: function(){
			if (this.state.enabled) {
				if (this.settings.elements.prevNext) {
					utils.enableButton(this.$dom.prev);
					utils.enableButton(this.$dom.next);
				
					if (!this.settings.behavior.circular) {
						if (this.props.current === 0) {
							utils.disableButton(this.$dom.prev);
						} else {
							utils.enableButton(this.$dom.prev);
						}
						
						if (this.props.current === this.props.total - this.props.visible) {
							utils.disableButton(this.$dom.next);
						} else {
							utils.enableButton(this.$dom.next);
						}
					}
				}
				
				if (this.settings.elements.handles) {
					var currentIndex = this._getOriginalSlideIndex(this.props.current),
						currentHandles = (currentIndex > 0) ? ':gt(' + (currentIndex - 1) + '):lt(' + this.props.visible + ')' : ':lt(' + (currentIndex + this.props.visible) + ')';

					utils.enableButton(this.$dom.handles);
					
					this.$dom.handles.removeClass('state-current');
					this.$dom.handles.filter(currentHandles).addClass('state-current');
				}
			} else {
				if (this.settings.elements.prevNext) {
					utils.disableButton(this.$dom.prev);
					utils.disableButton(this.$dom.next);
				}
				
				if (this.settings.elements.handles) {
					utils.disableButton(this.$dom.handles);
				}
			}
			
			if (this.settings.elements.counter) {
				var counterCurrent = this._getOriginalSlideIndex(this.props.current) + 1,
					counterCurrentMax = counterCurrent + (this.props.visible - 1),
					text;
				
				if (this.props.visible > 1) {
					if (counterCurrentMax > this.props.total) {
						counterCurrentMax = this.props.total;
					}
					counterCurrent += '-' + counterCurrentMax;
				}
				text = this.settings.text.counter.replace('%current%', counterCurrent).replace('%total%', this.props.total);
				
				this.$dom.counter.text(text);
			}
		}
	};


	$.fn[namespace] = function(options) {
		var args = arguments;

		return this.each(function(){
			var $this = $(this),
				instance = $this.data(namespace);

			if (instance) {
				if (typeof options === 'object') {
					// New settings
					instance.update.apply(instance, args);
				} else {
					instance[options].apply(instance, Array.prototype.slice.call(args, 1));
				}
			} else {
				new Plugin(this, options).init();
			}
		});
	};

	window[namespace.charAt(0).toUpperCase() + namespace.substr(1)] = Plugin;
})(window, document, jQuery);