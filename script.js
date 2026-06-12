'use strict';

var default_options = {};

function $(id) { return document.getElementById(id); }

var uglify_options;
var $options           = $('options');
var $out               = $('out');
var $in                = $('in');
var $error             = $('error');
var $errorPane         = $('error-pane');
var $statsIn           = $('stats-in');
var $statsOut          = $('stats-out');
var $btn_options       = $('btn-options');
var $btn_go            = $('btn-go');
var $btn_copy          = $('btn-copy');
var $btn_download      = $('btn-download');
var $fileUpload        = $('file-upload');
var $dropZone          = $('drop-zone');
var $modalOverlay      = $('modal-overlay');
var $toastContainer    = $('toast-container');

function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

var ICONS = {
  success: '<svg class="toast-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  error:   '<svg class="toast-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  info:    '<svg class="toast-icon" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.5v3M8 5.5v.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
};

function show_toast(msg, type, duration) {
  type     = type     || 'success';
  duration = duration || 2200;

  var el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = ICONS[type] + '<span>' + msg + '</span>';
  $toastContainer.appendChild(el);

  requestAnimationFrame(function() {
    requestAnimationFrame(function() { el.classList.add('show'); });
  });

  setTimeout(function() {
    el.classList.remove('show');
    setTimeout(function() {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 200);
  }, duration);
}

function set_output_buttons(enabled) {
  $btn_copy.disabled     = !enabled;
  $btn_download.disabled = !enabled;
}
set_output_buttons(false);

$('header-link').onclick = function(e) {
  e.preventDefault();
  go_to_start();
};

$btn_options.onclick = function() {
  $modalOverlay.classList.add('open');
};
$('btn-options-close').onclick = function() {
  $modalOverlay.classList.remove('open');
};
$modalOverlay.onclick = function(e) {
  if (e.target === $modalOverlay) $modalOverlay.classList.remove('open');
};
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && $modalOverlay.classList.contains('open')) {
    $modalOverlay.classList.remove('open');
  }
});

$btn_go.onclick = go;
$('btn-options-save').onclick  = set_options;
$('btn-options-reset').onclick = reset_options;
$in.oninput = function() { last_minified = null; go_to_start(); };
$out.onfocus = select_text;

var $copyText = $btn_copy.querySelector('.btn-text');
$btn_copy.onclick = function() {
  if (!$out.value) return;
  navigator.clipboard.writeText($out.value).then(function() {
    $btn_copy.classList.add('copied');
    if ($copyText) $copyText.textContent = 'Copied!';
    show_toast('Copied to clipboard', 'success');
    setTimeout(function() {
      $btn_copy.classList.remove('copied');
      if ($copyText) $copyText.textContent = 'Copy';
    }, 1800);
  }).catch(function() {
    show_toast('Copy failed', 'error');
  });
};

$btn_download.onclick = function() {
  if (!$out.value) return;
  var filename = current_filename
    ? current_filename.replace(/\.js$/i, '.min.js')
    : 'output.min.js';
  var blob = new Blob([$out.value], { type: 'text/javascript' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  show_toast('Saved ' + filename, 'info');
};

var current_filename = '';

function load_file(file) {
  if (!file) return;
  if (!file.name.match(/\.js$/i)) {
    show_toast('Only .js files are supported', 'error');
    return;
  }
  current_filename = file.name;
  var reader = new FileReader();
  reader.onload = function(e) {
    $in.value = e.target.result;
    last_minified = null;
    go_to_start();

    if (!isMobileDevice()) {
      $in.focus();
    } else {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    }

    show_toast('Loaded ' + file.name, 'info');
  };
  reader.readAsText(file);
}

$fileUpload.onchange = function() {
  if (this.files && this.files[0]) load_file(this.files[0]);
  this.value = '';
};

var $inputPanel = $in.closest('.panel');
$inputPanel.addEventListener('dragover', function(e) {
  e.preventDefault();
  $dropZone.classList.add('active');
});
$inputPanel.addEventListener('dragleave', function(e) {
  if (!$inputPanel.contains(e.relatedTarget)) $dropZone.classList.remove('active');
});
$inputPanel.addEventListener('drop', function(e) {
  e.preventDefault();
  $dropZone.classList.remove('active');
  load_file(e.dataTransfer.files[0]);
});

var default_options_text;
set_options_initial();

function get_options(value) {
  return new Function('return (' + (value || $options.value) + ');')();
}

function set_options() {
  var old_options = uglify_options;
  try {
    uglify_options = get_options();
    try {
      if (default_options_text === $options.value)
        localStorage.removeItem('uglify-options');
      else
        localStorage.setItem('uglify-options', $options.value);
    } catch (e) {}
    go(true);
    $modalOverlay.classList.remove('open');
    show_toast('Options applied', 'success');
    return true;
  } catch (e) {
    if (e instanceof JS_Parse_Error) {
      show_error(e, $in.value);
      return true;
    } else {
      uglify_options = old_options;
      show_error(e);
      return false;
    }
  }
}

function reset_options() {
  $options.value = default_options_text;
  set_options();
  show_toast('Options reset to defaults', 'info');
}

function set_options_initial() {
  default_options_text = $options.textContent || $options.innerText;
  default_options = get_options(default_options_text);
  try {
    var options_text = localStorage.getItem('uglify-options');
    if (options_text) $options.value = options_text;
  } catch (e) {}
  try {
    uglify_options = get_options();
  } catch (e) {
    $options.value = default_options_text;
    uglify_options = default_options;
  }
}

function encodeHTML(str) {
  return (str + '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

var last_minified;
function go(throw_on_error) {
  var input = $in.value;
  if (input === last_minified) return;
  if (throw_on_error === true) {
    main();
  } else {
    try { main(); } catch (e) { show_error(e, input); }
  }

  function main() {
    if (!input || input === $in.textContent) { go_to_start(); return; }
    var res = minify(input, uglify_options);
    if (res.error) throw res.error;
    $errorPane.classList.remove('visible');
    $out.style.display = '';
    $out.value = res.code || '';
    last_minified = input;
    set_output_buttons(!!res.code);
    var saved = Math.round((1 - res.code.length / input.length) * 100);
    show_toast('Minified - ' + saved + '% smaller', 'success');
    $statsIn.textContent  = input.length.toLocaleString() + ' bytes';
    $statsOut.textContent = res.code.length.toLocaleString() + ' bytes';
  }
}

function show_error(e, param) {
  $out.style.display = 'none';
  $errorPane.classList.add('visible');
  $statsIn.textContent  = '';
  $statsOut.textContent = '';
  set_output_buttons(false);
  var msg = 'Parse error';
  if (e instanceof JS_Parse_Error) {
    var input = param;
    var lines = input.split('\n');
    var line  = lines[e.line - 1];
    msg = 'Line ' + e.line + ': ' + e.message;
    e = 'Parse error: <strong>' + encodeHTML(e.message) + '</strong>\n' +
      '<small>Line ' + e.line + ', column ' + (e.col + 1) + '</small>\n\n' +
      (lines[e.line - 2] ? (e.line - 1) + ': ' + encodeHTML(lines[e.line - 2]) + '\n' : '') +
      e.line + ': ' +
        encodeHTML(line.substr(0, e.col)) +
        '<mark>' + encodeHTML(line.substr(e.col, 1) || ' ') + '</mark>' +
        encodeHTML(line.substr(e.col + 1)) + '\n' +
      (lines[e.line] ? (e.line + 1) + ': ' + encodeHTML(lines[e.line]) : '');
  } else if (e instanceof Error) {
    msg = e.message;
    e = e.name + ': <strong>' + encodeHTML(e.message) + '</strong>';
  } else {
    e = '<strong>' + encodeHTML(e) + '</strong>';
  }
  $error.innerHTML = e;
  show_toast(msg, 'error', 3500);
}

function go_to_start() {
  $out.value = '';
  set_output_buttons(false);
  $out.style.display = '';
  $errorPane.classList.remove('visible');
  $statsIn.textContent  = '';
  $statsOut.textContent = '';
}

function select_text() {
  var self = this;
  self.select();
  self.onmouseup = self.onkeyup = function() {
    self.onmouseup = self.onkeyup = null;
    self.scrollTop = 0;
    return false;
  };
  return false;
}