window.makeDraggable = function makeDraggable(element) {
  let offsetX = 0;
  let offsetY = 0;

  function move(clientX, clientY) {
    const maxX = window.innerWidth - element.offsetWidth;
    const maxY = window.innerHeight - element.offsetHeight;

    element.style.left = `${Math.max(0, Math.min(clientX - offsetX, maxX))}px`;
    element.style.top = `${Math.max(0, Math.min(clientY - offsetY, maxY))}px`;
    element.style.right = "auto";
    element.style.transform = "none";
  }

  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("a, button, input")) return;

    const bounds = element.getBoundingClientRect();
    offsetX = event.clientX - bounds.left;
    offsetY = event.clientY - bounds.top;
    element.setPointerCapture(event.pointerId);
    element.classList.add("is-dragging");
  });

  element.addEventListener("pointermove", (event) => {
    if (!element.hasPointerCapture(event.pointerId)) return;
    move(event.clientX, event.clientY);
  });

  function stopDragging(event) {
    if (element.hasPointerCapture(event.pointerId)) {
      element.releasePointerCapture(event.pointerId);
    }
    element.classList.remove("is-dragging");
  }

  element.addEventListener("pointerup", stopDragging);
  element.addEventListener("pointercancel", stopDragging);

  window.addEventListener("resize", () => {
    const bounds = element.getBoundingClientRect();
    if (
      bounds.right <= window.innerWidth &&
      bounds.bottom <= window.innerHeight
    ) {
      return;
    }

    offsetX = 0;
    offsetY = 0;
    move(bounds.left, bounds.top);
  });
};
