// pashua.js - Make Pashua http://www.bluem.net/de/mac/pashua/ accessible from node

// Copyright 2011 by Hans Hübner

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

var fs = require('fs');
var util = require('util');
var child_process = require('child_process');
var path = require('path');

function dialog(/* [callback], [window-options], options */)
{
    var optionStart = 0;
    var callback = function () {};
    var globalOptions = {};

    if (typeof arguments[optionStart] == 'function') {
        callback = arguments[optionStart];
        optionStart++;
    }

    if (typeof arguments[optionStart] == 'object') {
        globalOptions = arguments[optionStart];
        optionStart++;
    }
    
    var script = [];
    function addAttribute(key, value) {
        if (typeof value == 'object') {
            for (var subkey in value) {
                if (typeof value[subkey] == 'object' && value[subkey].length) {
                    for (var index in value[subkey]) {
                        script.push(key + '.' + subkey, value[subkey][index]);
                    }
                } else {
                    script.push(key + '.' + subkey, value[subkey]);
                }
            }
        } else {
            script.push(key);
            script.push(value);
        }
    }

    function addArray(array) {
        for (var i = 0; i < array.length; i += 2) {
            addAttribute(array[i], array[i + 1]);
        }
    }

    function addHash(hash) {
        for (var key in hash) {
            addAttribute(key, hash[key]);
        }
    }

    // collect options, flattening the arguments of the function (may
    // be individual keys and values, arrays or objects)
    for (var i = optionStart; i < arguments.length; i++) {
        var arg = arguments[i];
        if (typeof arg == 'object') {
            if (arg.length != undefined) {
                addArray(arg);
            } else {
                addHash(arg)
            }
        } else {
            addAttribute(arg, arguments[i + 1]);
            i++;
        }
    }

    // convert the argument to a string, replacing all occurences of
    // "\n" by "[return]" so that it is interpreted by Pashua
    // correctly.
    function toQuotedString(value) {
        return value.toString().replace(/\n/g, "[return]");
    }

    var filename = "/tmp/node-pashua." + process.pid;
    var fd = fs.openSync(filename, "w");
    // write options to file
    for (var key in globalOptions) {
        fs.writeSync(fd, '*.' + key + " = " + toQuotedString(globalOptions[key]) + "\n");
    }
    for (var i = 0; i < script.length; i += 2) {
        var key = script[i];
        var value = script[i + 1];
        fs.writeSync(fd, key + " = " + toQuotedString(value) + "\n");
    }
    fs.closeSync(fd);

    function findPashua() {
        var locations = [ process.execPath.replace(/[^\/]*$/, "Pashua"),
                          '/Applications/Pashua.app/Contents/MacOS/Pashua'
                        ];
        for (var i in locations) {
            var candidate = locations[i];
            if (path.existsSync(candidate)) {
                return candidate;
            }
        }
        throw "Pashua not found in any of these locations: " + locations;
    }

    function processReply(text) {
        var retval = {};
        text.replace(/([^=]+)=(.*)\n/g, function (match, key, value) {
            value = value.replace(/\[return\]/g, "\n");
            // parse integers, assuming that this is the Right Thing
            if (value.match(/^\d+$/)) {
                value = parseInt(value);
            }
            retval[key] = value;
        });
        return retval
    }

    child_process.exec(findPashua() + ' -e utf8 ' + filename,
                       function (error, stdout, stderr) {
                           if (error) {
                               fs.unlink(filename);
                               callback('error executing Pashua: ' + error);
                           } else if (stderr) {
                               callback('Pashua reported error: ' + stderr + ' - Pashua configuration kept in ' + filename);
                           } else {
                               fs.unlinkSync(filename);
                               callback(undefined, processReply(stdout));
                           }
                       });
}

exports.dialog = dialog;
