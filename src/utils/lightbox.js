export function setupLightbox({ dialog, imageElement, captionElement, triggerSelector }) {
  if (!dialog || !imageElement) {
    return;
  }

  document.addEventListener("click", (event) => {
    const trigger = event.target.closest(triggerSelector);

    if (!trigger) {
      return;
    }

    imageElement.src = trigger.dataset.image || "";
    imageElement.alt = trigger.dataset.caption || "婚纱照预览";

    if (captionElement) {
      captionElement.textContent = "";
    }

    if (!dialog.open) {
      dialog.showModal();
    }
  });

  dialog.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    const clickedOutside =
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom;

    if (clickedOutside) {
      dialog.close();
    }
  });
}
