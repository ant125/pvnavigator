import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/actions/trustpilot", () => ({
  recordTrustpilotClick: vi.fn(async () => "saved"),
  recordTrustpilotShown: vi.fn(async () => {}),
}));

import { AccountDashboard } from "./AccountDashboard";
const props = {email:"demo@example.de", calculations:[], hasInvoices:false, calculateUrl:"https://speicher.pvnavigator.de/calculate",speicherOrigin:"https://speicher.pvnavigator.de"};
describe("account dashboard",()=>{
 it("shows empty state and preserves analysis destination",()=>{
  const html=renderToStaticMarkup(<AccountDashboard {...props}/>);
  expect(html).toContain("Noch keine Berechnungen");
  expect(html).toContain("Feedback &amp; Support");
  expect(html).toContain("Sie haben noch keine Anfragen.");
  expect(html).toContain('href="/feedback"');
  expect(html).toContain(props.calculateUrl);
  expect(html).not.toContain('/api/billing/invoices');
 });
 it("distinguishes a failed request from an empty account",()=>{
  const html=renderToStaticMarkup(<AccountDashboard {...props} loadError/>);
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("Noch keine Berechnungen");
 });
 it("preserves saved reports and conditional invoice access",()=>{
  const html=renderToStaticMarkup(<AccountDashboard {...props} hasInvoices calculations={[{id:"00000000-0000-4000-8000-000000000001",product_key:"speicher_grenze",name:"Beispiel",summary_address:null,summary_pv_kwp:8,summary_consumption_kwh:4000,created_at:"2026-11-01",updated_at:"2026-11-01"}]}/>);
  expect(html).toContain("00000000-0000-4000-8000-000000000001");
  expect(html).toContain("Beispiel");
  expect(html).toContain('/api/billing/invoices');
  expect(html).not.toContain("Ihre Meinung ist uns wichtig!");
 });
 it("asks an incomplete profile to be filled without hiding calculations",()=>{
  const html=renderToStaticMarkup(<AccountDashboard {...props} profile={{accountKind:null,givenName:"",familyName:"",companyName:""}}/>);
  expect(html).toContain("Bitte ergänzen Sie Ihr Profil");
  expect(html).toContain(props.calculateUrl);
  expect(html).toContain("Meine Berechnungen");
 });
 it("keeps a saved profile editable and hides the completion notice",()=>{
  const html=renderToStaticMarkup(<AccountDashboard {...props} profile={{accountKind:"unternehmen",givenName:"Grace",familyName:"Hopper",companyName:"Analytical Engines GmbH"}} profileStatus="saved"/>);
  expect(html).toContain("Analytical Engines GmbH");
  expect(html).toContain("Profil gespeichert.");
  expect(html).not.toContain("Bitte ergänzen Sie Ihr Profil");
  expect(html).toContain(props.calculateUrl);
 });
 it("places the Trustpilot invitation under the saved calculations when the server allows it",()=>{
  const html=renderToStaticMarkup(<AccountDashboard {...props} trustpilotShow trustpilotRecordShown calculations={[{id:"00000000-0000-4000-8000-000000000001",product_key:"speicher_grenze",name:"Beispiel",summary_address:null,summary_pv_kwp:8,summary_consumption_kwh:4000,created_at:"2026-11-01",updated_at:"2026-11-01"}]}/>);
  expect(html.indexOf("Meine Berechnungen")).toBeLessThan(html.indexOf("Ihre Meinung ist uns wichtig!"));
  expect(html).toContain("Hat Ihnen SPEICHERGRENZE bei Ihrer Planung geholfen?");
  expect(html).toContain('href="https://www.trustpilot.com/review/pvnavigator.de"');
  expect(html).toContain('target="_blank"');
  expect(html).toContain('rel="noopener noreferrer"');
  expect(html).toContain("Auf Trustpilot bewerten");
  expect(html).not.toContain("PDF herunterladen");
  expect(html).not.toContain("widget.trustpilot.com");
 });
 it("hides the invitation when the calculation history failed to load",()=>{
  const html=renderToStaticMarkup(<AccountDashboard {...props} loadError trustpilotShow/>);
  expect(html).toContain('role="alert"');
  expect(html).not.toContain("Ihre Meinung ist uns wichtig!");
 });
 it("shows the Administration entry only to an administrator",()=>{
  for (const html of [renderToStaticMarkup(<AccountDashboard {...props}/>), renderToStaticMarkup(<AccountDashboard {...props} isAdmin={false}/>)]) {
   expect(html).not.toContain("Administration");
   expect(html).not.toContain("/admin");
  }
  const html=renderToStaticMarkup(<AccountDashboard {...props} isAdmin/>);
  expect(html).toContain("Administration");
  expect(html).toContain('href="/admin"');
  expect(html).toContain("Meine Berechnungen");
  expect(html).toContain(props.calculateUrl);
 });
});
