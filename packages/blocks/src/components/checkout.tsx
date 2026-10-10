import type { ComponentConfig } from "@puckeditor/core";
import { getRuntime } from "../runtime";
import { OrderFormView, type OrderFormSettings } from "./order-form-view";
import { UpsellView, type UpsellSettings } from "./upsell-view";

export type OrderFormProps = OrderFormSettings;
export const OrderForm: ComponentConfig<OrderFormProps> = {
  label: "Order form",
  fields: {
    layout: {
      type: "radio",
      label: "Layout",
      options: [
        { label: "One step", value: "one-step" },
        { label: "Two steps", value: "two-step" },
      ],
    },
    contactTitle: { type: "text", label: "Contact section title" },
    paymentTitle: { type: "text", label: "Payment section title" },
    buttonLabel: { type: "text", label: "Button label" },
    showSummary: {
      type: "radio",
      label: "Order summary",
      options: [
        { label: "Show", value: true },
        { label: "Hide", value: false },
      ],
    },
    guarantee: { type: "text", label: "Trust line (e.g. 30-day guarantee)" },
  },
  defaultProps: {
    layout: "one-step",
    contactTitle: "Your details",
    paymentTitle: "Payment",
    buttonLabel: "Complete my order",
    showSummary: true,
    guarantee: "30-day money-back guarantee",
  },
  render: ({ puck, id: _id, ...p }) => <OrderFormView {...p} runtime={getRuntime(puck.metadata)} />,
};

export type UpsellOfferProps = UpsellSettings;
export const UpsellOffer: ComponentConfig<UpsellOfferProps> = {
  label: "Upsell buttons",
  fields: {
    acceptLabel: { type: "text", label: "Yes button" },
    acceptSublabel: { type: "text", label: "Yes button small text" },
    showPrice: {
      type: "radio",
      label: "Show price on button",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    declineLabel: { type: "text", label: "No thanks link" },
  },
  defaultProps: {
    acceptLabel: "Yes! Add this to my order",
    acceptSublabel: "One click: no need to re-enter your card",
    showPrice: true,
    declineLabel: "No thanks, I'll pass on this offer",
  },
  render: ({ puck, id: _id, ...p }) => <UpsellView {...p} runtime={getRuntime(puck.metadata)} />,
};
