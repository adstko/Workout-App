// ui.js — in-page dialogs that replace the browser's confirm() and prompt().
// (Some places a page can run, like embedded viewers, block the native pop-ups.)
//
//   if (await askConfirm("Delete this?", "Delete")) { ... }
//   const name = await askText("Preset name", "Push Day");   // null if cancelled

const dialogBox = document.getElementById("dialog");
const dialogMsg = document.getElementById("dialog-msg");
const dialogInput = document.getElementById("dialog-input");
const dialogOk = document.getElementById("dialog-ok");
const dialogCancel = document.getElementById("dialog-cancel");

function askConfirm(message, okLabel, cancelLabel) {
  return ask(message, null, okLabel, cancelLabel);
}

function askText(message, value) {
  return ask(message, value || "", "Save", "Cancel");
}

function ask(message, textValue, okLabel, cancelLabel) {
  const isText = textValue !== null;
  // Test hook: the automated tests set this so they can drive the native pop-ups
  if (window.__nativeDialogs) return Promise.resolve(isText ? prompt(message, textValue) : confirm(message));

  return new Promise(resolve => {
    dialogMsg.textContent = message;
    dialogInput.hidden = !isText;
    dialogInput.value = textValue || "";
    dialogOk.textContent = okLabel || "OK";
    dialogCancel.textContent = cancelLabel || "Cancel";
    dialogOk.classList.toggle("danger", /^(Delete|Discard|Remove)/.test(okLabel || ""));
    dialogBox.hidden = false;
    (isText ? dialogInput : dialogOk).focus();

    const close = answer => {
      dialogBox.hidden = true;
      dialogOk.onclick = dialogCancel.onclick = dialogInput.onkeydown = null;
      resolve(answer);
    };
    dialogOk.onclick = () => close(isText ? dialogInput.value : true);
    dialogCancel.onclick = () => close(isText ? null : false);
    dialogInput.onkeydown = e => { if (e.key === "Enter") dialogOk.click(); };
  });
}
