'use strict';

const { createLocalTracks } = require('twilio-video');

const localTracks = {
  audio: null,
  video: null
};


async function applyInputDevice(kind, deviceId, render) {

  const [track] = await createLocalTracks({ [kind]: { deviceId } });

  if (localTracks[kind]) {
    localTracks[kind].stop();
  }

  localTracks[kind] = track;
  render(track);
}


async function getInputDevices(kind) {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter(device => device.kind === `${kind}input`);
}

async function selectMedia(kind, $modal, render) {
  const $apply = $('button', $modal);
  const $inputDevices = $('select', $modal);
  const setDevice = () => applyInputDevice(kind, $inputDevices.val(), render);

  let devices =  await getInputDevices(kind);

  await applyInputDevice(kind, devices[0].deviceId, render);

  if (devices.every(({ deviceId, label }) => !deviceId || !label)) {
    devices = await getInputDevices(kind);
  }

  $inputDevices.html(devices.map(({ deviceId, label }) => {
    return `<option value="${deviceId}">${label}</option>`;
  }));

  return new Promise(resolve => {
    $modal.on('shown.bs.modal', function onShow() {
      $modal.off('shown.bs.modal', onShow);

      // When the user selects a different media input device, apply it.
      $inputDevices.change(setDevice);

      // When the user clicks the "Apply" button, close the modal.
      $apply.click(function onApply() {
        $inputDevices.off('change', setDevice);
        $apply.off('click', onApply);
        $modal.modal('hide');
      });
    });

    $modal.on('hidden.bs.modal', function onHide() {
      $modal.off('hidden.bs.modal', onHide);

      if (localTracks[kind]) {
        localTracks[kind].stop();
        localTracks[kind] = null;
      }

      const deviceId = $inputDevices.val();
      localStorage.setItem(`${kind}DeviceId`, deviceId);
      resolve(deviceId);
    });

    $modal.modal({
      backdrop: 'static',
      focus: true,
      keyboard: false,
      show: true
    });
  });
}

module.exports = selectMedia;
