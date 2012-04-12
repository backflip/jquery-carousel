# Yet Another jQuery Carousel / Slider Thingy

It's better than all the others, of course:

* **Responsive** resizing on window resize (debounced, don't worry), height adapts to content
* **Swipe-enabled** for touch devices
* **Accessible** navigation elements (use your keyboard)
* **Circular mode** without cloning elements (they are shifted around instead)

Is uses Mark Dalgleish's [«Highly Configurable jQuery Plugins» pattern](http://markdalgleish.com/2011/05/creating-highly-configurable-jquery-plugins/).

*Tested on* IE 7-9, FF 3.6 and 11, Opera 11.62, Safari 5.1.5, Chrome 18, Mobile Safari on iOS 4 and 5, default Android browser on HTC Hero.

## How to use

See demos on http://backflip.github.com/jquery-carousel

* Include some basic styling
* Include jQuery and the script
* Initialize carousel with `<script>$('#carousel').carousel(options);</script>` or `<script>var carousel = new Carousel($('#carousel'), options); carousel.init();</script>`

## Methods

* **init(options)**: Add DOM elements and initialize carousel
* **enable**: Bind events for navigation, start autoplay if set
* **disable**: Unbind events for navigation stop autoplay
* **resize**: Resize elements based on available width and their content
* **goTo(index, skipAnimation)**
* **next**
* **prev**
* **update(options)**: Override current options and update carousel accordingly
* **destroy**: Remove added DOM elements, unbind events

## Defaults

```js
defaults: {
	animation: {
		duration: 300,    // milliseconds
		step: 1           // number of slides per animation (might be lower than number of visible slides)
	},
	behavior: {
		horizontal: true, // set to false for vertical slider
		circular: false,  // go to first slide after last one
		autoplay: 0,      // auto-advance interval (0: no autoplay)
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
}
```