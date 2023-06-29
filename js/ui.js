class UI {

  constructor() {
    // this.root;
    document.body.addEventListener('touchstart', e => {
      console.log('e', e.touches[0].force)
    });
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

  get detector() { return document.querySelector('#detector'); }

  get pitch() { return document.querySelector('#pitch'); }

  get note() { return document.querySelector('#note'); }

  get detune() { return document.querySelector('#detune_amt'); }

  // get detuneAmount() { return document.querySelector('#detune_amt'); }

  get detectToggle() { return document.querySelector('#detect-toggle'); }

  get demoToggle() { return document.querySelector('#demo-toggle'); }

  addEventListener(elementName, event, handler) {

  }
}

export const ui = new UI();