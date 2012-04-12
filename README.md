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

* **init**: Add DOM elements and initialize carousel
* **enable**: Bind events for navigation, start autoplay if set
* **disable**: Unbind events for navigation stop autoplay
* **resize**: Resize elements based on available width and their content
* **goTo(index, skipAnimation)**
* **next**
* **prev**
* **update(options)**: Override current options and update carousel accordingly
* **destroy**: Remove added DOM elements, unbind events