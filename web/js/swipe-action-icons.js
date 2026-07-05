"use strict";

/**
 * Swipe action icons aligned with native SwiftUI swipeActions labels.
 * Pin/trash use SF Symbol SVG approximations; partner apps use exported PNG assets.
 */
window.MindBebopSwipeActionIcons = (function () {
  function pin(pinned) {
    var slash = pinned
      ? '<path d="M1.4 1.2 12.6 12.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" fill="none"></path>'
      : "";
    return (
      '<span class="mb-swipe-pin-wrap" aria-hidden="true">' +
      '<svg class="mb-swipe-sf-icon" viewBox="0 0 14 14" fill="currentColor" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M7 1.1C4.7 1.1 2.9 2.9 2.9 5.2c0 2.9 2.4 4.4 4.1 7.5.15.22.55.22.7 0 1.7-3.1 4.1-4.6 4.1-7.5 0-2.3-1.8-4.1-4.1-4.1zm0 2.2a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8z"></path>' +
      slash +
      "</svg></span>"
    );
  }

  function trash() {
    return (
      '<svg class="mb-swipe-sf-icon" viewBox="0 0 14 16" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5.2 0h3.6v1.6H5.2V0ZM1.8 1.6h10.4v1.6H1.8V1.6Zm.9 3.2h1.4v9.6H2.7V4.8Zm2.8 0h1.4v9.6H5.5V4.8Zm2.8 0h1.4v9.6H8.3V4.8ZM3.2 15h7.6l.6-10.4H2.6L3.2 15Z"></path>' +
      "</svg>"
    );
  }

  function partner(src) {
    return '<img src="' + src + '" alt="" class="mb-swipe-partner-icon">';
  }

  return {
    pin: pin,
    trash: trash,
    partner: partner
  };
})();
