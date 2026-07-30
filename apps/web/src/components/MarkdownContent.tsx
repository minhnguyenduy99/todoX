import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { transformMarkdownUrl } from '../utils/markdownSecurity';

const DISALLOWED_ELEMENTS = ['table', 'thead', 'tbody', 'tr', 'th', 'td'];

interface MarkdownContentProps {
  children: string;
  className?: string;
}

function MarkdownLink({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  if (!href) {
    return <span>{children}</span>;
  }

  const isExternal = /^https?:\/\//i.test(href);

  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return <a href={href}>{children}</a>;
}

export function MarkdownContent({ children, className }: MarkdownContentProps) {
  return (
    <div className={['markdown-content', className].filter(Boolean).join(' ')}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        disallowedElements={DISALLOWED_ELEMENTS}
        urlTransform={transformMarkdownUrl}
        components={{
          a: MarkdownLink,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
