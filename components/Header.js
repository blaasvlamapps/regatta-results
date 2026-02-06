import Link from "next/link";

export default function Header({ title }) {
  return (
    <header className="site-header">
      <Link href="/" className="site-brand">
        Regatta Results
      </Link>
      {title ? <span className="site-title">{title}</span> : null}
    </header>
  );
}
