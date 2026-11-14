"use client";

import { useState } from "react";

import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_PRODUCTS,
  type FeedbackCalculationOption,
  type FeedbackProductKey,
} from "@/lib/feedback";

const field = "block text-sm font-medium text-[#29332e]";

export function FeedbackForm({
  calculations,
  hint,
  initialProduct = "",
}: {
  calculations: FeedbackCalculationOption[];
  hint?: string | null;
  initialProduct?: FeedbackProductKey | "";
}) {
  const [product, setProduct] = useState<FeedbackProductKey | "">(initialProduct);

  return (
    <form action="/feedback/neu" method="post" className="space-y-4">
      {hint ? <p role="alert" className="hub-notice">{hint}</p> : null}
      <div>
        <label htmlFor="feedback-product" className={field}>Produkt</label>
        <select
          id="feedback-product"
          name="product_key"
          required
          className="hub-input"
          value={product}
          onChange={(event) => setProduct(event.target.value as FeedbackProductKey | "")}
        >
          <option value="">Bitte wählen</option>
          {FEEDBACK_PRODUCTS.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="feedback-category" className={field}>Kategorie</label>
        <select id="feedback-category" name="category" required className="hub-input" defaultValue="">
          <option value="">Bitte wählen</option>
          {FEEDBACK_CATEGORIES.map((item) => (
            <option key={item.key} value={item.key}>{item.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="feedback-subject" className={field}>Betreff</label>
        <input id="feedback-subject" name="subject" required maxLength={120} className="hub-input" />
      </div>
      <div>
        <label htmlFor="feedback-body" className={field}>Nachricht</label>
        <textarea id="feedback-body" name="body" required maxLength={4000} rows={8} className="hub-input" />
      </div>
      {product === "speicher_grenze" ? (
        <div>
          <label htmlFor="feedback-calculation" className={field}>Berechnung auswählen</label>
          <select id="feedback-calculation" name="calculation_id" className="hub-input" defaultValue="">
            <option value="">Keine Berechnung</option>
            {calculations.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <p className="mt-2 text-xs text-[#627067]">Optional. Nur eine eigene Berechnung von SPEICHERGRENZE.</p>
        </div>
      ) : null}
      <button type="submit" className="hub-primary">Anfrage senden</button>
    </form>
  );
}
