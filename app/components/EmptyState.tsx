import type { ReactNode } from "react";

type EmptyStateProps = {
  eyebrow: string;
  title: string;
  description: string;
  actionLabel: string;
  children?: ReactNode;
};

export function EmptyState({ eyebrow, title, description, actionLabel, children }: EmptyStateProps) {
  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      <div className="empty-state__content">
        <p className="empty-state__eyebrow">{eyebrow}</p>
        <h2 className="empty-state__title" id="empty-state-title">
          {title}
        </h2>
        <p className="empty-state__description">{description}</p>
      </div>
      {children ? <div className="empty-state__supporting">{children}</div> : null}
      <button className="button button--primary" type="button">
        {actionLabel}
      </button>
    </section>
  );
}
