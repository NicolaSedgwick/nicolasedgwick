/**
 * Problem-report endpoint for the Pony Club C Test Practice app.
 *
 * Paste this whole file into a Google Apps Script project bound to a Google
 * Sheet, then deploy it as a Web app. Full instructions are in README.md under
 * "Setting up problem reports".
 *
 * Each report arrives as a row in the sheet, and (optionally) as an email.
 */

// Leave as "" for no email — the sheet still fills up either way.
var NOTIFY_EMAIL = "";

// Tab in the spreadsheet where reports are collected. Created automatically.
var SHEET_NAME = "Reports";

var HEADERS = [
  "Received", "Card ID", "Theme", "Topic", "No.", "Important",
  "Question", "Answer at the time", "What's wrong", "From", "Page"
];


function doPost(e) {
  try {
    var report = JSON.parse(e.postData.contents);
    var sheet = getSheet_();

    sheet.appendRow([
      new Date(),
      report.id || "",
      report.theme || "",
      report.topic || "",
      report.number || "",
      report.important || "",
      report.question || "",
      report.answer || "",
      report.message || "",
      report.from || "",
      report.page || ""
    ]);

    if (NOTIFY_EMAIL) {
      notify_(report);
    }
    return reply_({ ok: true });

  } catch (err) {
    // Log it and still answer politely — a failed report should never look
    // like a crash to a child on a phone in a stable yard.
    console.error(err);
    return reply_({ ok: false, error: String(err) });
  }
}


/** Visiting the URL in a browser should say something friendly. */
function doGet() {
  return reply_({ ok: true, note: "C Test Practice report endpoint is running." });
}


function getSheet_() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = book.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}


function notify_(report) {
  var ref = (report.theme || "?") + " " + (report.number || "?");
  var body =
    "A problem has been reported in the C Test Practice app.\n\n" +
    "Card:     " + ref + "  (" + (report.topic || "") + ")\n" +
    "ID:       " + (report.id || "") + "\n\n" +
    "Question: " + (report.question || "") + "\n\n" +
    "Answer:   " + (report.answer || "(blank)") + "\n\n" +
    "Reported: " + (report.message || "") + "\n" +
    "From:     " + (report.from || "anonymous") + "\n\n" +
    report.page;

  MailApp.sendEmail({
    to: NOTIFY_EMAIL,
    subject: "C Test Practice — problem reported on " + ref,
    body: body
  });
}


function reply_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
