import type { ReactNode } from 'react';

interface SectionHeaderProps {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  aside?: ReactNode;
}

export function SectionHeader({ id, eyebrow, title, description, aside }: SectionHeaderProps) {
  return (
    <div className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="section-title" id={`${id}-title`}>
          {title}
        </h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {aside}
    </div>
  );
}
