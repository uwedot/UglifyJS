'use strict';

var MaxInputBytes = 5000000;
var MaxOptionsBytes = 20000;
var MaxUploadBytes = 5000000;
var AllowedUploadExtension = /\.js$/i;
var AllowedUploadMimeTypes = ['text/javascript', 'application/javascript', 'text/plain', ''];

var OptionsSchema = {
  parse: {
    bare_returns: 'boolean', expression: 'boolean', filename: 'nullable_string',
    html5_comments: 'boolean', shebang: 'boolean', strict: 'boolean', toplevel: 'nullable_string'
  },
  compress: {
    arrows: 'boolean', booleans: 'boolean', collapse_vars: 'boolean', comparisons: 'boolean',
    conditionals: 'boolean', dead_code: 'boolean', drop_console: 'boolean', drop_debugger: 'boolean',
    evaluate: 'boolean', expression: 'boolean', global_defs: 'plain_object', hoist_funs: 'boolean',
    hoist_props: 'boolean', hoist_vars: 'boolean', if_return: 'boolean', inline: 'number_or_boolean',
    join_vars: 'boolean', keep_fargs: 'boolean', keep_fnames: 'boolean', keep_infinity: 'boolean',
    loops: 'boolean', negate_iife: 'boolean', passes: 'number', properties: 'boolean',
    pure_getters: 'pure_getters_value', pure_funcs: 'nullable_string_array', reduce_funcs: 'boolean',
    reduce_vars: 'boolean', sequences: 'number_or_boolean', side_effects: 'boolean', switches: 'boolean',
    top_retain: 'nullable_string_or_array', toplevel: 'boolean', typeofs: 'boolean', unsafe: 'boolean',
    unsafe_comps: 'boolean', unsafe_Function: 'boolean', unsafe_math: 'boolean', unsafe_proto: 'boolean',
    unsafe_regexp: 'boolean', unsafe_undefined: 'boolean', unused: 'boolean'
  },
  mangle: {
    eval: 'boolean', keep_fnames: 'boolean', properties: 'boolean_or_object',
    reserved: 'string_array', toplevel: 'boolean'
  },
  output: {
    ascii_only: 'boolean', beautify: 'boolean', comments: 'boolean_or_string', indent_level: 'number',
    indent_start: 'number', inline_script: 'boolean', keep_quoted_props: 'boolean',
    max_line_len: 'number_or_boolean', preamble: 'nullable_string', preserve_line: 'boolean',
    quote_keys: 'boolean', quote_style: 'number', semicolons: 'boolean', shebang: 'boolean',
    source_map: 'nullable_any', webkit: 'boolean', width: 'number', wrap_iife: 'boolean'
  },
  wrap: 'boolean'
};

function validate_options_value(value, kind) {
  switch (kind) {
    case 'boolean':
      return typeof value === 'boolean';
    case 'number':
      return typeof value === 'number' && isFinite(value);
    case 'number_or_boolean':
      return typeof value === 'boolean' || (typeof value === 'number' && isFinite(value));
    case 'boolean_or_string':
      return typeof value === 'boolean' || typeof value === 'string';
    case 'boolean_or_object':
      return typeof value === 'boolean' || (value !== null && typeof value === 'object' && !Array.isArray(value));
    case 'nullable_string':
      return value === null || typeof value === 'string';
    case 'nullable_any':
      return value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'object';
    case 'nullable_string_array':
      return value === null || (Array.isArray(value) && value.every(function(v) { return typeof v === 'string'; }));
    case 'nullable_string_or_array':
      return value === null || typeof value === 'string' ||
        (Array.isArray(value) && value.every(function(v) { return typeof v === 'string'; }));
    case 'string_array':
      return Array.isArray(value) && value.every(function(v) { return typeof v === 'string'; });
    case 'plain_object':
      return value !== null && typeof value === 'object' && !Array.isArray(value);
    case 'pure_getters_value':
      return typeof value === 'boolean' || value === 'strict';
    default:
      return false;
  }
}

function validate_options_section(input, schema, path) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid options: "' + path + '" must be an object');
  }
  var inputKeys = Object.keys(input);
  for (var i = 0; i < inputKeys.length; i++) {
    var key = inputKeys[i];
    if (!Object.prototype.hasOwnProperty.call(schema, key)) {
      throw new Error('Invalid options: unexpected field "' + path + '.' + key + '"');
    }
  }
  var schemaKeys = Object.keys(schema);
  for (var j = 0; j < schemaKeys.length; j++) {
    var schemaKey = schemaKeys[j];
    if (!Object.prototype.hasOwnProperty.call(input, schemaKey)) continue;
    if (!validate_options_value(input[schemaKey], schema[schemaKey])) {
      throw new Error('Invalid options: "' + path + '.' + schemaKey + '" has an unexpected type or value');
    }
  }
}

function validate_options_object(input) {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid options: root must be an object');
  }
  var topKeys = Object.keys(input);
  var schemaTopKeys = Object.keys(OptionsSchema);
  for (var i = 0; i < topKeys.length; i++) {
    if (schemaTopKeys.indexOf(topKeys[i]) === -1) {
      throw new Error('Invalid options: unexpected field "' + topKeys[i] + '"');
    }
  }
  if (Object.prototype.hasOwnProperty.call(input, 'parse')) {
    validate_options_section(input.parse, OptionsSchema.parse, 'parse');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'compress')) {
    validate_options_section(input.compress, OptionsSchema.compress, 'compress');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'mangle')) {
    validate_options_section(input.mangle, OptionsSchema.mangle, 'mangle');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'output')) {
    validate_options_section(input.output, OptionsSchema.output, 'output');
  }
  if (Object.prototype.hasOwnProperty.call(input, 'wrap') && typeof input.wrap !== 'boolean') {
    throw new Error('Invalid options: "wrap" must be a boolean');
  }
  return input;
}

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
  el.innerHTML = ICONS[type] + '<span>' + encodeHTML(msg) + '</span>';
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
  if (!file.name || typeof file.name !== 'string' || !AllowedUploadExtension.test(file.name)) {
    show_toast('Only .js files are supported', 'error');
    return;
  }
  if (file.size > MaxUploadBytes) {
    show_toast('File too large - limit is ' + (MaxUploadBytes / 1000000) + ' MB', 'error');
    return;
  }
  if (file.type && AllowedUploadMimeTypes.indexOf(file.type) === -1) {
    show_toast('Unsupported file type', 'error');
    return;
  }
  current_filename = file.name.slice(0, 255);
  var reader = new FileReader();
  reader.onload = function(e) {
    var text = e.target.result;
    if (typeof text !== 'string') {
      show_toast('Could not read file', 'error');
      return;
    }
    if (text.length > MaxInputBytes) {
      show_toast('File content too large - limit is ' + (MaxInputBytes / 1000000) + ' MB', 'error');
      return;
    }
    $in.value = text;
    last_minified = null;
    go_to_start();

    if (!isMobileDevice()) {
      $in.focus();
    } else {
      if (document.activeElement && document.activeElement.blur) {
        document.activeElement.blur();
      }
    }
  };
  reader.onerror = function() {
    show_toast('Could not read file', 'error');
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
  var text = value || $options.value;
  if (typeof text !== 'string') {
    throw new Error('Invalid options: expected text');
  }
  if (text.length > MaxOptionsBytes) {
    throw new Error('Options too large: limit is ' + MaxOptionsBytes.toLocaleString() + ' characters');
  }
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('Invalid options: must be valid JSON');
  }
  return validate_options_object(parsed);
}

function set_options() {
  var old_options = uglify_options;
  try {
    uglify_options = get_options();
    try {
      if (default_options_text === $options.value)
        localStorage.removeItem('uglify-options');
      else if ($options.value.length <= MaxOptionsBytes)
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
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

var last_minified;
function go(throw_on_error) {
  var input = $in.value;
  if (input === last_minified) {
    show_toast('Already minified - no changes detected', 'info');
    return;
  }
  if (throw_on_error === true) {
    main();
  } else {
    try { main(); } catch (e) { show_error(e, input); }
  }

  function main() {
    if (!input || input === $in.textContent) { go_to_start(); return; }
    if (input.length > MaxInputBytes) {
      throw new Error('Input too large - limit is ' + (MaxInputBytes / 1000000) + ' MB');
    }
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
