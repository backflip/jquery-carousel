# Yet Another jQuery Carousel / Slider Thingy

It's better than all the others, of course:

* **Responsive** resizing on window resize (debounced, don't worry), height adapts to content
* **Swipe-enabled** for touch devices
* **Accessible** navigation elements (use your keyboard)
* **Circular mode** without cloning elements (they are shifted around instead)

Is uses Mark Dalgleish's [«Highly Configurable jQuery Plugins» pattern](http://markdalgleish.com/2011/05/creating-highly-configurable-jquery-plugins/).

**Tested on:** IE 7-9, FF 3.6 and 11, Chrome 18, Safari 5.1.5, Opera 11.62, Mobile Safari on iOS 4 and 5.
*Coming soon:* IE 6, default Android browser on a HTC Hero.

## How to use

Demos: http://backflip.github.com/jquery-carousel/

* Include some basic styling (see below)
* Include jQuery and the script
* Initialize carousel:
 
```js
$('#carousel').carousel(options);
``` 

or 

```js
var carousel = new Carousel($('#carousel'), options);
carousel.init();
```

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

## Default options

```js
{
	animation: {
		duration: 300,    // milliseconds
		step: 1           // number of slides per animation (might be lower than number of visible slides)
	},
	behavior: {
		horizontal: true, // set to false for vertical slider
		circular: false,  // go to first slide after last one
		autoplay: 0,      // auto-advance interval (0: no autoplay)
		pauseAutoplayOnHover: true, // guess what: auto-advance is paused when hovering the container
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

## Basic styling

```css
.carousel-frame {
	border: 1px solid #999;
	overflow: hidden;
	position: relative;
}

.carousel-slider {
	list-style: none;
	margin: 0;
	padding: 0;
	position: relative;
	/* Trigger hardware acceleration */
		   -moz-transform: translateZ(0);
		    -ms-transform: translateZ(0);
		     -o-transform: translateZ(0);
		-webkit-transform: translateZ(0);
	transform:             translateZ(0);
}
.carousel-slide {
	float: left;
	margin: 0;
	padding: 0;
}

/* Prev / next navigation */
.carousel-nav {
	margin: 0.5em 0;
	zoom: 1;
}
.carousel-nav:before,
.carousel-nav:after {
	content: "";
	display: table;
}
.carousel-nav:after {
	clear: both;
}
.carousel-nav span {
	cursor: pointer;
	float: left;
}
.carousel-nav .carousel-next {
	float: right;
}
.carousel-nav .state-disabled {
	color: #999;
	cursor: default;
	outline: none;
}

/* Counter ("slide x of y") */
.carousel-counter {
	margin: 0.5em 0;
}

/* Handles */
.carousel-handles {
	margin: 0.5em 0;
	text-align: center;
}
.carousel-handles span {
	cursor: pointer;
	margin: 0 0.5em;
}
.carousel-handles .state-disabled {
	color: #999;
	cursor: default;
	outline: none;
}
.carousel-handles .state-current {
	color: #c30;
	cursor: default;
	outline: none;
}
```