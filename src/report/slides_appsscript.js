/**
 * Google Apps Script – plak dit in script.google.com
 * 1) Zet TEMPLATE_ID van je Google Slides template
 * 2) Sla een `results.json` bestand op in Drive en vul RESULTS_FILE_ID
 * 3) Run generateReport()
 */

const TEMPLATE_ID = 'VUL_HIER_JE_SLIDES_TEMPLATE_ID_IN';
const RESULTS_FILE_ID = 'VUL_HIER_DRIVE_FILE_ID_VAN_results.json_IN';

function generateReport() {
  const data = JSON.parse(DriveApp.getFileById(RESULTS_FILE_ID).getBlob().getDataAsString());
  const copy = Slides.Presentations.copy({ title: `Audit – ${data.site}` }, TEMPLATE_ID);
  const pid = copy.presentationId;

  function replace(tag, value) {
    Slides.Presentations.batchUpdate({
      requests: [{
        replaceAllText: {
          containsText: { text: `{{${tag}}}`, matchCase: false },
          replaceText: String(value)
        }
      }]
    }, pid);
  }

  replace('SITE', data.site);
  replace('TECH_SCORE', data.scores.techniek.toFixed(1));
  replace('TECH_COLOR', data.colors.techniek);
  replace('SEC_SCORE', data.scores.veiligheid.toFixed(1));
  replace('UX_SCORE', data.scores.gebruikersvriendelijkheid.toFixed(1));
  replace('LEGAL_SCORE', data.scores.legal.toFixed(1));
  replace('MKT_SCORE', data.scores.marketing.toFixed(1));

  const bullets = data.backlog.map(i => `• ${i.title} — ${i.why} (Impact ${i.impact}, Effort ${i.effort}, ${i.priority})`).join('\n');
  replace('BACKLOG', bullets);
}
