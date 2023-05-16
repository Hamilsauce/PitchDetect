class UI {

  constructor() {
    // this.root;
    this.demoToggle.addEventListener('click', e => {});
  };

  get tuner() {
    return {
      display: document.querySelector('#detector'),
      pitch: document.querySelector('#pitch'),
      note: document.querySelector('#note'),
      detune: document.querySelector('#detune'),
      detuneAmount: document.querySelector('#detune_amt'),
    };
  }

  get detectorElem() { return document.querySelector('#detector'); }

  get pitchElem() { return document.querySelector('#pitch'); }

  get noteElem() { return document.querySelector('#note'); }

  get detuneElem() { return document.querySelector('#detune_amt'); }

  get detuneAmount() { return document.querySelector('#detune_amt'); }

  get detectToggle() { return document.querySelector('#detect-toggle'); }

  get demoToggle() { return document.querySelector('#demo-toggle'); }

  addEventListener(elementName, event, handler) {

  }
}

export const ui = new UI();