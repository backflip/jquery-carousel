/*!
 * jQuery Carousel Plugin
 *
 * @author Thomas Jaggi, http://responsive.ch
 * @license Dual licensed under MIT and GPL 2
 * @link https://github.com/backflip/jquery-carousel
 */

;(function(window, document, $, undefined) {
	"use strict";

	var namespace = 'carousel', // Used for jQuery plugin name, event namespacing, CSS classes

		defaults = { // Default settings (see examples in case something isn't not obvious)
			domSelectors: {
				frame: '.' + namespace + '-frame',
				slider: '.' + namespace + '-slider',
				slides: '.' + namespace + '-slide'
			},
			templates: {
				navContainer: '<div class="' + namespace + '-navs" aria-hidden="true" role="presentation" />',
				navItemPrev: '<button class="' + namespace + '-nav" role="presentation">Show previous slide</button>',
				navItemNext: '<button class="' + namespace + '-nav" role="presentation">Show next slide</button>',
				counter: '<div class="' + namespace + '-counter" aria-hidden="true" role="presentation">%current% of %total%</div>',
				handleContainer: '<div class="' + namespace + '-handles" aria-hidden="true" role="presentation" />',
				handleItem: '<button class="' + namespace + '-handle" role="presentation">%index%</div>'
			},
			stateClasses: {
				isInitialized: 'is-initialized',
				isEnabled: 'is-enabled',
				isDisabled: 'is-disabled',
				isActive: 'is-active'
			},
			animation: {
				duration: 300, // milliseconds
				step: 1, // number of slides per animation (might be lower than number of visible slides)
				easing: 'ease-in-out'
			},
			behavior: {
				circular: false, // go to first slide after last one
				autoplay: 0, // auto-advance interval (0: no autoplay)
				pauseAutoplayOnHover: true,
				keyboardNav: true // enable arrow and [p][n] keys for prev / next actions
			},
			layout: {
				horizontal: true, // set to false for vertical slider
				groupedHandles: true, // combine handles to group if visibleSlides > 1 (e.g. "1-3", "4-6", "7")
				fixedHeight: true, // set height based on highest slide
				responsive: true, // whether to update the dimensions on window resize (debounced)
				visibleSlides: 1, // how many slides to fit within visible area (0: calculate based on initial width)
				gutter: 0 // spacing between slides
			},
			elements: { // which navigational elements to show
				prevNext: true, // buttons for previous / next slide
				handles: true, // button for each slide showing its index
				counter: true // "Slide x of y"
			},
			events: { // custom callbacks
				start: false, // function(targetDomIndex, targetSlideIndex) { … }
				stop: false // function(targetDomIndex, targetSlideIndex) { … }
			},
			initialSlide: 0, // which slide to show on init
			touch: { // whether to enable touch support and which criteria to use for swipe movement
				enabled: true,
				thresholds: {
					speed: 0.4, // multiplied by width of slider per second
					distance: 0.3 // multiplied by width of slider
				}
			},
			$syncedCarousels: null // jQuery collection of carousel elements to sync with
		},

		utils = {
			// Return supported CSS transition property
			// (based on https://gist.github.com/556448)
			getTransitionProperty: function() {
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
			getTransitionEndEvent: function() {
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
			getNamespacedEvents: function(events) {
				var arr = events.split(' ');

				for (var i = 0; i < arr.length; i++) {
					arr[i] = arr[i] + '.' + namespace;
				}

				return arr.join(' ');
			},

			// Enable button
			enableButton: function($element) {
				$element
					.removeAttr('disabled')
					.attr("tabindex", 0);
			},

			// Disable button
			disableButton: function($element) {
				$element
					.attr('disabled', true)
					.attr("tabindex", -1);
			}
		},

		// Detect browser support for touch events and CSS transition
		support = {
			touch: (typeof window.Modernizr !== 'undefined' && typeof Modernizr.touch !== 'undefined') ? Modernizr.touch : (('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch),
			transition: utils.getTransitionProperty() // returns false if not supported
		},

		// Event for syncing
		syncEvent = 'carouselUpdate',

		// Detect movements if touch events are supported
		isSwiping = false,
		isScrolling = false,

		// Number of instances
		instances = 0;

	var Plugin = function(element, options) {
			this.$dom = {
				container: $(element),
				frame: null,
				slider: null,
				slides: null,
				navContainer: null,
				navItems: null,
				counter: null,
				handleContainer: null,
				handleItems: null
			};

			this.counterText = null;

			this.props = {
				currentDomIndex: 0,
				currentSlideIndex: 0,
				total: 0,
				visible: 0
			};

			this.state = {
				enabled: false,
				animating: false
			};

			this.settings = $.extend(true, {}, options, this.$dom.container.data(namespace + '-options'));
		};

	Plugin.prototype = {

		/**
		 * Public methods
		 */

		init: function() {
			var $dom = this.$dom,
				$navItemPrev, $navItemNext,
				resizeTimeout = null;

			// Already initiated or empty
			if ($dom.container.data(namespace) || $dom.container.length === 0) {
				return this;
			}

			// Index of this carousel instance
			this.index = instances++;

			// Save settings
			this.settings = $.extend(true, {}, defaults, this.settings);

			// Add class
			$dom.container.addClass(this.settings.stateClasses.isInitialized);

			// Save DOM elements
			$dom.frame = $dom.container.find(this.settings.domSelectors.frame);
			$dom.slider = $dom.container.find(this.settings.domSelectors.slider);
			$dom.slides = $dom.container.find(this.settings.domSelectors.slides);

			// Add prev / next link
			if (this.settings.elements.prevNext) {
				$dom.navContainer = $(this.settings.templates.navContainer).appendTo($dom.container);

				$navItemPrev = $(this.settings.templates.navItemPrev).appendTo($dom.navContainer);
				$navItemNext = $(this.settings.templates.navItemNext).appendTo($dom.navContainer);

				$dom.navItems = $navItemPrev.add($navItemNext);
			}

			// Add counter ("slide x of y")
			if (this.settings.elements.counter) {
				$dom.counter = $(this.settings.templates.counter).appendTo($dom.container);

				this.counterText = $dom.counter.text();
			}

			// Add handle container
			if (this.settings.elements.handles) {
				$dom.handleContainer = $(this.settings.templates.handleContainer).appendTo($dom.container);
			}

			// Init slides
			if (this.settings.behavior.circular) {
				$dom.slides.each(function(i) {
					$(this).data(namespace + '-index', i);
				});
			}

			if (!this.settings.layout.horizontal) {
				$dom.container.addClass(namespace + '-vertical');
			}

			this.update();

			// Re-calculate dimensions on window resize
			if (this.settings.layout.responsive) {
				$(window).on(utils.getNamespacedEvents('resize') + this.index, $.proxy(function() {
					if (resizeTimeout) {
						clearTimeout(resizeTimeout);
					}

					resizeTimeout = setTimeout($.proxy(function() {
						this.resize();
					}, this), 100);
				}, this));
			}

			// Save instance to data attribute
			$dom.container.data(namespace, this);

			return this;
		},

		update: function(options) {
			$.extend(true, this.settings, options);

			// Update jQuery slide object
			this.$dom.slides = this.$dom.container.find(this.settings.domSelectors.slides);

			// Update properties
			this.props.total = this.$dom.slides.length;
			this.props.currentDomIndex = (this.props.currentDomIndex > this.props.total) ? this.props.total : this.props.currentDomIndex;
			this.props.currentSlideIndex = (this.props.currentSlideIndex > this.props.total) ? this.props.total : this.props.currentDomIndex;
			this.props.visible = this._getVisibleSlides();

			// Update jQuery handle object
			if (this.settings.elements.handles) {
				this.$dom.handleContainer.html(this._getHandles());
				this.$dom.handleItems = this.$dom.handleContainer.children();
			}

			// Resize elements, disable and re-enable
			this.resize();
			this.disable();
			this.enable();
		},

		resize: function() {
			var containerWidth = this.$dom.frame.width(),
				containerHeight,
				gutter = this.settings.layout.gutter,
				gutterStyles = gutter ? (this.settings.layout.horizontal ? {
						'margin-left': 0.5 * gutter,
						'margin-right': 0.5 * gutter
					} : {
						'margin-top': 0.5 * gutter,
						'margin-bottom': 0.5 * gutter
					}) : {},
				slidesWidth = this.settings.layout.horizontal ? Math.floor(containerWidth / this.props.visible) : containerWidth,
				slidesHeight,
				sliderWidth = this.settings.layout.horizontal ? this.props.total * (slidesWidth + gutter) : slidesWidth;

			// Set new dimensions of items and slider
			this.$dom.slides.outerWidth(slidesWidth).css(gutterStyles);
			this.$dom.slider.width(sliderWidth).height('auto');

			if (this.settings.layout.fixedHeight) {
				// Get highest slide and set equal min-height for all slides
				slidesHeight = this._getHighestSlide();
				this.$dom.slides.css('min-height', slidesHeight);

				// Set container height based on slides' height
				containerHeight = this.settings.layout.horizontal ? slidesHeight : this.props.visible * (slidesHeight + gutter);
				this.$dom.frame.height(containerHeight);
			}

			// Jump to initial position
			this.goTo(this.props.currentDomIndex, true);
		},

		enable: function() {
			var self = this;

			if (this.state.enabled || this.props.visible > this.props.total) {
				return;
			}

			if (this.settings.elements.prevNext) {
				this.$dom.navItems.on(utils.getNamespacedEvents('click'), function() {
					var $this = $(this),
						dir, target;

					dir = $this.index() === 1 ? 1 : -1;
					target = dir * self.settings.animation.step + self.props.currentDomIndex;

					self.goTo(target);
				});
			}

			if (this.settings.elements.handles) {
				this.$dom.handleItems.on(utils.getNamespacedEvents('click'), function() {
					var $this = $(this),
						handleIndex = $this.data(namespace + '-handle-index') || $this.index(),
						slideIndex = self._getCurrentSlideIndex(handleIndex);

					self.goTo(slideIndex);
				});
			}

			if (this.settings.touch.enabled && support.touch) {
				this._touchEnable();
			}

			if (this.settings.behavior.keyboardNav) {
				this.$dom.container.on(utils.getNamespacedEvents('keydown'), $.proxy(function(event) {
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
							success = true;

						// [right arrow] or [n]
						} else if ($.inArray(code, [39, 78]) !== -1) {
							this.next();
							success = true;

						// number keys
						} else if (47 < code && code < 58) {
							targetIndex = code - 49;
							slideIndex = self._getCurrentSlideIndex(targetIndex);

							this.goTo(slideIndex);

							success = true;
						}
					}

					if (success) {
						this._autoplayDisable();
						event.preventDefault();
					}
				}, this));
			}

			// Scroll to parent slide when focusing an element inside
			this.$dom.slides.each(function() {
				var $this = $(this),
					index = $this.data(namespace + '-index') || self.$dom.slides.index($this),
					scrollLeft = self.$dom.frame.scrollLeft();

				$this.on(utils.getNamespacedEvents('focus'), '*', function() {
					// Reset initial position (before browser jumped to focused element)
					setTimeout(function() {
						self.$dom.frame.scrollLeft(scrollLeft);

						if (index > self.props.currentSlideIndex && index < (self.props.currentSlideIndex + self.props.visibleSlides)) {
							self.goTo(index);
						}
					}, 0);
				});
			});

			if (this.settings.behavior.autoplay) {
				this._autoplayEnable();

				if (this.settings.behavior.pauseAutoplayOnHover) {
					this.$dom.container.on(utils.getNamespacedEvents('mouseenter'), $.proxy(function() {
						this._autoplayDisable();
					}, this));

					this.$dom.container.on(utils.getNamespacedEvents('mouseleave'), $.proxy(function() {
						this._autoplayEnable();
					}, this));
				}
			}

			this.$dom.container.addClass(this.settings.stateClasses.isEnabled);
			this.$dom.container.removeClass(this.settings.stateClasses.isDisabled);

			this.state.enabled = true;

			this._updateNav();

			if (!this.settings.layout.fixedHeight) {
				this._updateHeight();
			}

			// Sync with other carousels
			if (this.settings.$syncedCarousels) {
				this.$dom.container.on(utils.getNamespacedEvents(syncEvent), $.proxy(function(event, params) {
					this.goTo(params.index, false, true);
				}, this));
			}
		},

		disable: function() {
			if (!this.state.enabled) {
				return;
			}

			this.$dom.container.off(utils.getNamespacedEvents(''));
			this.$dom.container.find('*').off(utils.getNamespacedEvents(''));

			this.$dom.container.addClass(this.settings.stateClasses.isDisabled);
			this.$dom.container.removeClass(this.settings.stateClasses.isEnabled);

			this.state.enabled = false;

			this._updateNav();

			if (!this.settings.layout.fixedHeight) {
				this._updateHeight();
			}
		},

		goTo: function(i, skipAnimation, synced) {
			if (this.state.animating) return;

			var self = this,
				index = this._getValidatedTarget(i),
				originalIndex = this._getOriginalSlideIndex(index),
				cssPosition = this._getTargetPosition(index),
				easing = (!support.transition && this.settings.animation.easing !== 'linear') ? 'swing' : this.settings.animation.easing,
				duration = skipAnimation ? 0 : this.settings.animation.duration,
				callback = function() {
					if (self.settings.events.stop) {
						self.settings.events.stop(index, originalIndex);
					}

					self._touchEnable();

					self.state.animating = false;
				},
				prop, transitionProp, endEvent, transition, oldTransition;

			if (!skipAnimation) {
				this.state.animating = true;

				self._touchDisable();

				if (this.settings.events.start) {
					this.settings.events.start(index, originalIndex);
				}

				if (!support.transition) {
					this.$dom.slider.animate(cssPosition, duration, easing, function() {
						callback();
					});
				} else {
					prop = support.transition;
					transitionProp = this.settings.layout.horizontal ? 'left' : 'top';
					endEvent = utils.getNamespacedEvents(utils.getTransitionEndEvent());
					oldTransition = this.$dom.slider.css(prop);
					transition = transitionProp + ' ' + (duration / 1000) + 's ' + easing;

					this.$dom.slider.css(prop, transition);
					this.$dom.slider.css(cssPosition);

					this.$dom.slider.on(endEvent, function() {
						self.$dom.slider.off(endEvent);
						self.$dom.slider.css(prop, oldTransition);

						callback();
					});
				}

				if (this.settings.$syncedCarousels && !synced) {
					this.settings.$syncedCarousels.trigger(utils.getNamespacedEvents(syncEvent), {
						index: index
					});
				}
			} else {
				this.$dom.slider.css(cssPosition);
			}

			this.props.currentDomIndex = index;
			this.props.currentSlideIndex = originalIndex;

			this._updateNav();

			if (!this.settings.layout.fixedHeight) {
				this._updateHeight();
			}
		},
		next: function() {
			this.goTo(this.props.currentDomIndex + this.settings.animation.step);
		},
		prev: function() {
			this.goTo(this.props.currentDomIndex - this.settings.animation.step);
		},

		destroy: function() {
			this.$dom.container.removeData(namespace).removeClass(this.settings.stateClasses.isInitialized);

			this.$dom.slides.removeData(namespace + '-index');

			this.$dom.frame.removeAttr('style');
			this.$dom.slider.removeAttr('style');
			this.$dom.slides.removeAttr('style');

			this.$dom.navContainer && this.$dom.navContainer.remove();
			this.$dom.handleContainer && this.$dom.handleContainer.remove();
			this.$dom.counter && this.$dom.counter.remove();

			this.state.enabled = false;
			this.props.currentDomIndex = 0;
			this.props.currentSlideIndex = 0;

			this.$dom.container.off(utils.getNamespacedEvents(''));
			this.$dom.container.find('*').off(utils.getNamespacedEvents(''));

			$(window).off(utils.getNamespacedEvents('resize') + this.index);
		},

		/**
		 * Pseudo-private helper functions
		 */

		_autoplayEnable: function() {
			this.autoplay = setInterval($.proxy(function() {
				this.next();
			}, this), this.settings.behavior.autoplay);
		},

		// Clear autoplay interval
		_autoplayDisable: function() {
			clearInterval(this.autoplay);
			this.autoplay = null;
		},

		// Return a group of handles (one for each slide)
		_getHandles: function() {
			var $handles = $(),
				slideGroups = this.props.total,
				i = 0,
				$handle, text;

			if (!this.settings.layout.groupedHandles) {
				for (; i < slideGroups; i++) {
					$handle = $(this.settings.templates.handleItem);

					text = $handle.text().replace('%index%', (i + 1));

					$handle.text(text);

					$.merge($handles, $handle);
				}
			} else {
				slideGroups = this.props.total / this.props.visible;

				for (; i < slideGroups; i++) {
					var minIndex = i * this.props.visible + 1,
						maxIndex = (i + 1) * this.props.visible,
						index;

					$handle = $(this.settings.templates.handleItem);

					text = $handle.text();

					if (maxIndex > this.props.total) {
						maxIndex = this.props.total;
					}

					if (minIndex < maxIndex) {
						index = minIndex + ' - ' + maxIndex;
					} else {
						index = maxIndex;
					}

					text = text.replace('%index%', index);

					$handle.text(text).data(namespace + '-handle-index', minIndex - 1);

					$.merge($handles, $handle);
				}
			}

			return $handles;
		},

		// Return maximal height of slides
		_getHighestSlide: function(filterSelector) {
			var height = 0,
				$slides = this.$dom.slides;

			if (filterSelector) {
				$slides = $slides.filter(filterSelector);
			}

			$slides.each(function() {
				var slideHeight = $(this).css('min-height', 0).outerHeight();

				if (slideHeight > height) {
					height = slideHeight;
				}
			});

			return height;
		},

		// Return original slide index (in circular mode, slides change their index)
		_getOriginalSlideIndex: function(currentIndex) {
			var index = currentIndex;

			if (this.settings.behavior.circular) {
				index = this.$dom.slides.eq(currentIndex).data(namespace + '-index');
			}

			return index;
		},
		// Return slide position by original index
		_getCurrentSlideIndex: function(originalIndex) {
			var index = originalIndex;

			if (this.settings.behavior.circular) {
				this.$dom.slides.each(function() {
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
		_getStyles: function($element) {
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
		_getTargetPosition: function(index) {
			var slidesSize = this.settings.layout.horizontal ? this.$dom.slides.outerWidth() : this.$dom.slides.outerHeight(),
				gutter = this.settings.layout.gutter,
				prop = this.settings.layout.horizontal ? 'left' : 'top',
				css = {};

			css[prop] = - (index * (slidesSize + gutter) + 0.5 * gutter);

			return css;
		},

		// Return target slide index (calls _shiftSlides() if necessary)
		_getValidatedTarget: function(i) {
			if (this.props.total <= this.props.visible) {
				i = 0;
			} else if (!this.settings.behavior.circular) {
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
		_getVisibleSlides: function() {
			if (this.settings.layout.visibleSlides > 0) {
				return this.settings.layout.visibleSlides;
			} else {
				var self = this,
					minSize = 0,
					containerSize = this.settings.layout.horizontal ? this.$dom.frame.width() : this.$dom.frame.height();

				this.$dom.slides.each(function() {
					var size = self.settings.layout.horizontal ? $(this).outerWidth() : $(this).outerHeight();

					if (size > minSize) {
						minSize = size;
					}
				});

				return Math.round(containerSize / minSize);
			}
		},

		// Shift slides around in circular mode
		_shiftSlides: function(index, dir) {
			var selector = (dir === -1) ? ':gt(' + (index - 1) + ')' : ':lt(' + (index + 1) + ')',
				$slides = this.$dom.slides.filter(selector);

			if ($slides.length > 0) {
				var axis = this.settings.layout.horizontal ? 'left' : 'top',
					slideDimension = this.settings.layout.horizontal ? this.$dom.slides.outerWidth() : this.$dom.slides.outerHeight(),
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

        _getTouchDistance: function(coords) {
            var distance = {
                    x: coords.end.x - coords.start.x,
                    y: coords.end.y - coords.start.y
                };

            // Swap coords if slider is vertical
            if (!this.settings.layout.horizontal) {
                distance = {
                    x: distance.y,
                    y: distance.x
                };
            }

            return distance;
        },

		// Bind touch events
		_touchEnable: function() {
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

			events[utils.getNamespacedEvents('touchstart')] = function(e) {
				var event = e.originalEvent.targetTouches[0];

				coords.start.x = event.pageX;
				coords.start.y = event.pageY;

				sliderOffset = self.$dom.slider.position();

				time.start = new Date().getTime();

				isSwiping = false;
				isScrolling = false;
			};
			events[utils.getNamespacedEvents('touchmove')] = function(e) {
				if (isScrolling && !isSwiping) {
					return;
				}

				// TODO: Debounce

				var event = e.originalEvent.targetTouches[0],
					distance = 0,
					animProps = {},
					positionProp = self.settings.layout.horizontal ? 'left' : 'top',
					refDimension;

				coords.end.x = event.pageX;
				coords.end.y = event.pageY;

				distance = self._getTouchDistance(coords);

				// Swiping the carousel
				if (Math.abs(distance.x) > Math.abs(distance.y) || isSwiping) {
					refDimension = self.settings.layout.horizontal ? sliderOffset.left : sliderOffset.top;
					animProps[positionProp] = refDimension + distance.x;

					self.$dom.slider.css(animProps);

					if (self.settings.$syncedCarousels) {
						self.settings.$syncedCarousels.each(function() {
                            var instance = $(this).data(namespace);

                            instance.$dom.slider.css(animProps);
                        });
					}

					isSwiping = true;

					e.preventDefault();
				// "Scrolling"
				} else {
					isScrolling = true;
				}
			};
			events[utils.getNamespacedEvents('touchend')] = function() {
				if (!isSwiping || isScrolling) {
					return;
				}

				var distance = self._getTouchDistance(coords),
					speed,
					targetSlide = self.props.currentDomIndex;

				// Check if swipe direction was correct
				if (Math.abs(distance.x) > Math.abs(distance.y)) {
					time.end = new Date().getTime();
					speed = Math.abs(distance.x) / (time.end - time.start) * 1000;

					// Check if either swipe distance or speed was sufficient
					if (Math.abs(distance.x) > thresholds.distance || speed > thresholds.speed) {
						var refDimension = self.settings.layout.horizontal ? self.$dom.slides.outerWidth() : self.$dom.slides.outerHeight(),
							swipeDir = (distance.x > 0) ? -1 : 1,
							slidesSwiped = Math.abs(Math.round(distance.x / refDimension));

						// Short but quick swipe
						if (slidesSwiped < 1 && speed > thresholds.speed) {
							slidesSwiped = 1;
						}

						targetSlide = self.props.currentDomIndex + swipeDir * slidesSwiped;
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
		_touchDisable: function() {
			this.$dom.frame.off(utils.getNamespacedEvents('touchstart touchmove touchend'));
		},

		// Update navigational elements (enable / disable buttons, set class)
		// TODO: called twice on init
		_updateNav: function() {
			if (this.state.enabled) {
				if (this.settings.elements.prevNext) {
					utils.enableButton(this.$dom.navItems.eq(0));
					utils.enableButton(this.$dom.navItems.eq(1));

					if (!this.settings.behavior.circular) {
						if (this.props.currentDomIndex === 0) {
							utils.disableButton(this.$dom.navItems.eq(0));
						} else {
							utils.enableButton(this.$dom.navItems.eq(0));
						}

						if (this.props.currentDomIndex === this.props.total - this.props.visible) {
							utils.disableButton(this.$dom.navItems.eq(1));
						} else {
							utils.enableButton(this.$dom.navItems.eq(1));
						}
					}
				}

				if (this.settings.elements.handles) {
					var currentIndex = this._getOriginalSlideIndex(this.props.currentDomIndex),
						currentHandles = (currentIndex > 0) ? ':gt(' + (currentIndex - 1) + '):lt(' + this.props.visible + ')' : ':lt(' + (currentIndex + this.props.visible) + ')';

					if (this.settings.layout.groupedHandles) {
						currentHandles = ':eq(' + Math.ceil(currentIndex / this.props.visible) + ')';
					}

					utils.enableButton(this.$dom.handleItems);

					this.$dom.handleItems.removeClass(this.settings.stateClasses.isActive);
					this.$dom.handleItems.filter(currentHandles).addClass(this.settings.stateClasses.isActive);
				}
			} else {
				if (this.settings.elements.prevNext) {
					utils.disableButton(this.$dom.navItems.eq(0));
					utils.disableButton(this.$dom.navItems.eq(1));
				}

				if (this.settings.elements.handles) {
					utils.disableButton(this.$dom.handleItems);
				}
			}

			if (this.settings.elements.counter) {
				var counterCurrent = this._getOriginalSlideIndex(this.props.currentDomIndex) + 1,
					counterCurrentMax = counterCurrent + (this.props.visible - 1),
					text;

				if (this.props.visible > 1) {
					if (counterCurrentMax > this.props.total) {
						counterCurrentMax = this.props.total;
					}
					counterCurrent += '-' + counterCurrentMax;
				}
				text = this.counterText.replace('%current%', counterCurrent).replace('%total%', this.props.total);

				this.$dom.counter.text(text);
			}
		},

		// Update slider based on currently visible slides
		// TODO: called twice on init
		_updateHeight: function() {
			var minIndex = this.props.currentDomIndex,
				maxIndex = minIndex + this.props.visible,
				filterSelector = (minIndex > 0) ? ':gt(' + (minIndex - 1) + '):lt(' + this.props.visible + ')' : ':lt(' + (maxIndex) + ')',
				maxHeight = this._getHighestSlide(),
				currentFrameHeight = this.$dom.frame.height(),
				height = this._getHighestSlide(filterSelector);

			if (maxHeight < currentFrameHeight) {
				maxHeight = currentFrameHeight;
			}

			this.$dom.slides.css('min-height', maxHeight);

			this.$dom.frame.animate({
				height: height
			}, this.settings.animation.duration, $.proxy(function() {
				this.$dom.slides.css('min-height', height);
			}, this));
		}
	};

	$.fn[namespace] = function(options) {
		var args = arguments;

		return this.each(function() {
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
