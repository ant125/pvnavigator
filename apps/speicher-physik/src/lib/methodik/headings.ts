import {
  Children,
  isValidElement,
  type FunctionComponent,
  type ReactNode,
} from "react";

export type MethodikTocItem = {
  id: string;
  title: string;
  level: 2 | 3;
};

type HeadingProps = {
  id?: string;
  title: string;
  children?: ReactNode;
};

type MethodikHeadingComponent = FunctionComponent<HeadingProps> & {
  methodikLevel: 2 | 3;
};

export function slugifyHeading(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isHeadingComponent(
  type: unknown
): type is MethodikHeadingComponent {
  if (typeof type !== "function") return false;
  const level = (type as MethodikHeadingComponent).methodikLevel;
  return level === 2 || level === 3;
}

export function collectMethodikHeadings(node: ReactNode): MethodikTocItem[] {
  const items: MethodikTocItem[] = [];

  Children.forEach(node, (child) => {
    if (!isValidElement<HeadingProps>(child)) return;

    if (isHeadingComponent(child.type)) {
      const title = child.props.title;
      const id = child.props.id ?? slugifyHeading(title);
      items.push({
        id,
        title,
        level: child.type.methodikLevel,
      });
    }

    if (child.props.children) {
      items.push(...collectMethodikHeadings(child.props.children));
    }
  });

  return items;
}
