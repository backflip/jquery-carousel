Yet Another jQuery Carousel / Slider Thingy
===========================================

It's better than all the others, of course:

* **Responsive** resizing on window resize (debounced, don't worry), height adapts to content
* **Swipe-enabled** for touch devices
* **Accessible** navigation elements (use your keyboard)
* **Circular mode** without cloning elements (they are shifted around instead)

Is uses Mark Dalgleish's «Highly Configurable jQuery Plugins» pattern.

Tested on IE 7-9, FF 3.6 and 6, Opera 11.62, Safari 5.1.5, Chrome 18, Mobile Safari on iOS 4 and 5, Android Browser on HTC Hero.


# How to use (see demo)

* Include some basic styling
* Include jQuery and the script
* `<script>$('#carousel').carousel(options);` or `<script>var carousel = new Carousel($('#carousel'), options); carousel.init();`

# Methods

* init: Adds DOM elements and initializes carousel
* enable: Bind events for navigation, start autoplay if set
* disable: Unbind events for navigation stop autoplay
* resize: Resize elements based on available width and their content
* goTo(index, skipAnimation)
* next
* prev
* update(options): Override current options and update carousel accordingly
* destroy: Remove added DOM elements, unbind events