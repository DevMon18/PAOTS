const STATUS_CONFIG = {
  received:   { label: 'Received',   cls: 'status-received'  },
  designing:  { label: 'Designing',  cls: 'status-designing' },
  printing:   { label: 'Printing',   cls: 'status-printing'  },
  ready:      { label: 'Ready',      cls: 'status-ready'     },
  collected:  { label: 'Collected',  cls: 'status-collected' },
}

export default function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status?.toLowerCase()] || { label: status, cls: '' }
  return <span className={`status-badge ${cfg.cls}`}>{cfg.label}</span>
}

const PAYMENT_CONFIG = {
  downpayment: { label: 'Downpayment', cls: 'payment-downpayment' },
  partial:     { label: 'Partial',     cls: 'payment-partial'     },
  paid_full:   { label: 'Paid Full',   cls: 'payment-paid-full'   },
}

export function PaymentBadge({ status }) {
  const cfg = PAYMENT_CONFIG[status?.toLowerCase()] || { label: status, cls: '' }
  return <span className={`payment-badge ${cfg.cls}`}>{cfg.label}</span>
}
