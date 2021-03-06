
var OpenPDFExtension = {
    noContent: true,

    doAction: Zotero.Promise.coroutine(function* (uri) {
        // get arguments from uri
        // e.g. zotero://open-pdf/0_EFWJW9U7
        Zotero.ZotFile.uri = uri;
        var [key, page] = uri.path.substr(1).split('/');
        // exit if no key
        if(!key) return;
        // get zotero item from key
        var params = {objectType: 'item'};
        // Zotero.Items.parseLibraryKeyHash() is deprecated -- use .parseLibraryKey() instead
        var lkh = Zotero.Items.parseLibraryKeyHash(key);
        if (lkh) {
            params.libraryID = lkh.libraryID || Zotero.Libraries.userLibraryID;
            params.objectKey = lkh.key;
            if (params.libraryID == 0) params.libraryID = Zotero.Libraries.userLibraryID;
        }
        else {
            params.objectID = params.id;
        }
        Zotero.API.parseParams(params);
        var results = yield Zotero.API.getResultsFromParams(params);
        if (results.length == 0) return;
        var item = results[0];
        // if attachment, open file and go to page
        if(!item.isAttachment()) return;
        // get file and path
        var path = item.getFilePath(),
            filename = path.replace(/^.*[\\\/]/, '');
        // check whether pdf file
        if(filename.toLowerCase().indexOf('.pdf') == -1) return;
        // open pdf and go to page (system specific)
        if(Zotero.isMac) {
            var open_with = this.getPref('pdfExtraction.openPdfMac');
            if(open_with == 'Skim') {
                args = [
                    '-e', 'tell app "Skim" to activate', 
                    '-e', 'tell app "Skim" to open "' + path + '"'];
                if (page)
                    args.push('-e', 'tell document "' + filename + '" of application "Skim" to go to page ' + page);
                Zotero.Utilities.Internal.exec('/usr/bin/osascript', args);
                return;
            }
            // open pdf file
            yield Zotero.Utilities.Internal.exec('/usr/bin/open', ['-a', open_with, path]);
            // go to page using applescript
            args = [
              '-e', 'tell app "' + open_with + '" to activate', 
              '-e', 'tell app "System Events" to keystroke "g" using {option down, command down}', 
              '-e', 'tell app "System Events" to keystroke "' + page + '"',
              '-e', 'tell app "System Events" to keystroke return'];
            if (page) Zotero.Utilities.Internal.exec('/usr/bin/osascript', args);
        }
        if(Zotero.isWin) {
            // get path to PDF Reader
            var pdf_reader = this.getPref('pdfExtraction.openPdfWin');
            pdf_reader = pdf_reader === '' ? this.Utils.getPDFReader() : pdf_reader;
            if (!(yield OS.File.exists(pdf_reader))) {
                this.infoWindow(this.ZFgetString('general.error'), 'Unable to find path for PDF Reader. Please set path manually in hidden preferences (see zotfile documentation).');
                return;
            }
            // open pdf on page
            // Adobe Acrobat: http://partners.adobe.com/public/developer/en/acrobat/PDFOpenParameters.pdf
            // PDF-XChange: http://help.tracker-software.com/eu/default.aspx?pageid=PDFXView25:command_line_options
            if (page)
                args = ['/A', 'page=' + page, path];
            else
                args = [path];
            // run process
            Zotero.Utilities.Internal.exec(pdf_reader, args);
        }
        if(Zotero.isLinux) {
            var cmd = this.getPref('pdfExtraction.openPdfLinux');
            // try okular and evince when nothing is set
            if (cmd === '') {
                if (page)
                    args = ['-p', page, path];
                else
                    args = [path];
                // try okular
                if (yield OS.File.exists('/usr/bin/okular')) {
                    Zotero.Utilities.Internal.exec('/usr/bin/okular', args);
                }
                // try evince
                else {
                    if (yield OS.File.exists('/usr/bin/evince')) {
                        Zotero.Utilities.Internal.exec('/usr/bin/evince', args);
                    }
                    else {
                        this.infoWindow('Zotfile', this.ZFgetString('general.open.pdf'));
                    }
                }
            }
            else {
                // get page argument
                cmd = cmd.split('-');
                var arg = cmd.pop();
                // argument for call
                if (page)
                    args = ['-' + arg, page, path];
                else
                    args = [path];
                // run process
                Zotero.Utilities.Internal.exec(cmd.join('-'), args);
            }
        }
    }.bind(Zotero.ZotFile)),
    
    newChannel: function (uri) {
        this.doAction(uri);
    }
};

var zotero_ext = Components.classes["@mozilla.org/network/protocol;1?name=zotero"].getService();
var OpenPDFSpec = "zotero://open-pdf";
zotero_ext.wrappedJSObject._extensions[OpenPDFSpec] = OpenPDFExtension;
