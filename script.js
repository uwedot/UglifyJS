'use strict';

var default_options = {};

function $(id) { return document.getElementById(id); }

var uglify_options;
var $options           = $('options');
var $out               = $('out');
var $in                = $('in');
var $error             = $('error');
var $errorPane         = $('error-pane');
var $stats             = $('stats');
var $btn_options       = $('btn-options');
var $btn_go            = $('btn-go');
var $btn_copy          = $('btn-copy');
var $btn_download      = $('btn-download');
var $cb_as_i_type      = $('cb-as-i-type');
var $fileUpload        = $('file-upload');
var $dropZone          = $('drop-zone');
var $modalOverlay      = $('modal-overlay');

// ── Navigation ────────────────────────────
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

// ── Core ──────────────────────────────────
$btn_go.onclick = go;
$('btn-options-save').onclick   = set_options;
$('btn-options-reset').onclick  = reset_options;
$in.oninput = $in.onkeyup = $in.onblur = $in.onfocus = go_ait;
$cb_as_i_type.onclick = set_options_ait;
$out.onfocus = select_text;

// ── Copy ──────────────────────────────────
var $copyText = $btn_copy.querySelector('.btn-text');
$btn_copy.onclick = function() {
  if (!$out.value) return;
  navigator.clipboard.writeText($out.value).then(function() {
    $btn_copy.classList.add('copied');
    if ($copyText) $copyText.textContent = 'Copied!';
    setTimeout(function() {
      $btn_copy.classList.remove('copied');
      if ($copyText) $copyText.textContent = 'Copy';
    }, 1800);
  });
};

// ── Download ──────────────────────────────
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
};

// ── File upload ───────────────────────────
var current_filename = '';

function load_file(file) {
  if (!file || !file.name.match(/\.js$/i)) return;
  current_filename = file.name;
  var reader = new FileReader();
  reader.onload = function(e) {
    $in.value = e.target.result;
    go_ait();
    $in.focus();
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

// ── Options ───────────────────────────────
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
}

function set_options_ait() {
  try {
    if ($cb_as_i_type.checked)
      localStorage.removeItem('uglify-options-disable-ait');
    else
      localStorage.setItem('uglify-options-disable-ait', 1);
  } catch (e) {}
}

function set_options_initial() {
  default_options_text = $options.textContent || $options.innerText;
  default_options = get_options(default_options_text);
  try {
    var options_text = localStorage.getItem('uglify-options');
    if (options_text) $options.value = options_text;
    $cb_as_i_type.checked = !localStorage.getItem('uglify-options-disable-ait');
  } catch (e) {}
  try {
    uglify_options = get_options();
  } catch (e) {
    $options.value = default_options_text;
    uglify_options = default_options;
  }
}

// ── Minify ────────────────────────────────
function encodeHTML(str) {
  return (str + '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;');
}

var last_input;
function go(throw_on_error) {
  var input = $in.value;
  last_input = input;
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
    var saved = ((1 - res.code.length / input.length) * 100 || 0).toFixed(1);
    $stats.textContent = res.code.length.toLocaleString() + ' bytes · −' + saved + '%';
  }
}

var ait_timeout;
var ait_last_duration = 50;
function go_ait() {
  if (!$cb_as_i_type.checked) return;
  var input = $in.value;
  if (input === last_input) return;
  last_input = input;
  clearTimeout(ait_timeout);
  ait_timeout = setTimeout(function() {
    var start = new Date();
    go();
    ait_last_duration = new Date() - start;
  }, ait_last_duration);
}

function show_error(e, param) {
  $out.style.display = 'none';
  $errorPane.classList.add('visible');
  $stats.textContent = '';
  if (e instanceof JS_Parse_Error) {
    var input = param;
    var lines = input.split('\n');
    var line  = lines[e.line - 1];
    e = 'Parse error: <strong>' + encodeHTML(e.message) + '</strong>\n' +
      '<small>Line ' + e.line + ', column ' + (e.col + 1) + '</small>\n\n' +
      (lines[e.line - 2] ? (e.line - 1) + ': ' + encodeHTML(lines[e.line - 2]) + '\n' : '') +
      e.line + ': ' +
        encodeHTML(line.substr(0, e.col)) +
        '<mark>' + encodeHTML(line.substr(e.col, 1) || ' ') + '</mark>' +
        encodeHTML(line.substr(e.col + 1)) + '\n' +
      (lines[e.line] ? (e.line + 1) + ': ' + encodeHTML(lines[e.line]) : '');
  } else if (e instanceof Error) {
    e = e.name + ': <strong>' + encodeHTML(e.message) + '</strong>';
  } else {
    e = '<strong>' + encodeHTML(e) + '</strong>';
  }
  $error.innerHTML = e;
}

function go_to_start() {
  clearTimeout(ait_timeout);
  $out.value = '';
  $out.style.display = '';
  $errorPane.classList.remove('visible');
  $stats.textContent = '';
  return false;
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
