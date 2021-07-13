'use strict';

const { addUrlParams, getUrlParams } = require('./browser');
const catchAsync = require('./utils/catchasync');


function selectRoom($modal, error) {
  const $alert = $('div.alert', $modal);
  const $identity = $('#screen-name', $modal);
  const $join = $('button.btn-primary', $modal);
  const $roomId = $('#room-id', $modal);

  const { roomId } = getUrlParams();
  if (roomId) {
    $roomId.val(roomId);
  }

  const identity = localStorage.getItem('userName');
  if (identity) {
    $identity.val(identity);
  }

  if (error) {
    $alert.html(`<h5>${error.name}${error.message
      ? `: ${error.message}`
      : ''}</h5>${catchAsync(error)}`);
    $alert.css('display', '');
  } else {
    $alert.css('display', 'none');
  }

  return new Promise(resolve => {
    $modal.on('shown.bs.modal', function onShow() {
      $modal.off('shown.bs.modal', onShow);

      $join.click(function onJoin() {
        const identity = $identity.val();
        const roomId = $roomId.val();
        if (identity && roomId) {
          
          addUrlParams({ roomId });
          localStorage.setItem('userName', identity);

          $join.off('click', onJoin);
          $modal.modal('hide');
        }
      });
    });

    $modal.on('hidden.bs.modal', function onHide() {
      $modal.off('hidden.bs.modal', onHide);
      const identity = $identity.val();
      const roomId = $roomId.val();
      resolve({ identity, roomId });
    });

    $modal.modal({
      backdrop: 'static',
      focus: true,
      keyboard: false,
      show: true
    });
  });
}

module.exports = selectRoom;
