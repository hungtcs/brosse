export const CUSTOM_ELEMENT_METADATA = Symbol('CUSTOM_ELEMENT_METADATA');

export interface CustomElementMetadata {
  options?: CustomElementOptions
  template?: Promise<HTMLTemplateElement>;
  attributesMap?: Map<string|symbol, string>;
}

export interface CustomElementConstructor {
  new(): BaseHTMLElement & { [key: string]: any };
  observedAttributes?: Array<string>;
  [CUSTOM_ELEMENT_METADATA]?: CustomElementMetadata;
}

export abstract class BaseHTMLElement extends HTMLElement {
  public [CUSTOM_ELEMENT_METADATA]?: CustomElementMetadata;
  public onAdopted?(): void;
  public onConnected?(): void;
  public onDisconnected?(): void;
  public onAttributeChanged?(name: string, oldValue: string, newValue: string): void;

  private oldValueMap: Map<string|symbol, any> = new Map();

  constructor() {
    super();
    const metadata = this[CUSTOM_ELEMENT_METADATA];
    if(metadata) {
      if(metadata.options?.shadowDOM) {
        this.attachShadow({ mode: 'open' });
      }
      Array.from(metadata.attributesMap?.entries() ?? []).forEach(([propertyKey, attributeName]) => {
        const currentValue = Reflect.get(this, propertyKey);
        const propertyType = Reflect.getMetadata('design:type', this, propertyKey);
        Object.defineProperty(this, propertyKey, {
          get: function() {
            return propertyType === Boolean ? this.hasAttribute(attributeName) : this.getAttribute(attributeName);
          },
          set: function(value) {
            return (value === null || value === undefined)
              ? this.removeAttribute(attributeName, value)
              : propertyType === Boolean
                ? value ? this.setAttribute(attributeName, '') : this.removeAttribute(attributeName)
                : this.setAttribute(attributeName, value);
          }
        });
        this.oldValueMap.set(propertyKey, currentValue);
      });
    }
  }

  public adoptedCallback() {
    this.onAdopted?.();
  }

  public connectedCallback() {
    Array.from(this.oldValueMap.entries()).forEach(([propertyKey, value]) => {
      Reflect.get(this, propertyKey, this) ?? Reflect.set(this, propertyKey, value, this);
    });
    this.onConnected?.();
  }

  public disconnectedCallback() {
    this.onDisconnected?.();
  }

  public attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    this.onAttributeChanged?.(name, oldValue, newValue);
  }

}

export interface CustomElementOptions {
  selector: string;
  shadowDOM?: boolean;
  templateURL?: string;
}

export function CustomElement(options: CustomElementOptions) {
  return (Target: CustomElementConstructor) => {
    const metadata = Target[CUSTOM_ELEMENT_METADATA] ?? {};
    metadata.options = options;
    Target[CUSTOM_ELEMENT_METADATA] = metadata;

    Target.observedAttributes = Array.from(metadata.attributesMap?.values() ?? []);

    Object.defineProperty(Target.prototype, CUSTOM_ELEMENT_METADATA, {
      get: () => metadata,
    });

    if(options.templateURL) {
      metadata.template = fetch(options.templateURL)
        .then(response => response.text())
        .then(html => {
          const template = document.createElement('template');
          template.innerHTML = html;
          return template;
        });
    }

    window.customElements.define(metadata.options!.selector, Target);
  };
}

export function Attribute(name: string): PropertyDecorator {
  return (target, propertyKey) => {
    const Target = target.constructor as CustomElementConstructor;
    const metadata = Target[CUSTOM_ELEMENT_METADATA] ?? {};
    const attributesMap = metadata.attributesMap ?? new Map<string|symbol, string>();
    attributesMap.set(propertyKey, name);
    metadata.attributesMap = attributesMap;
    Target[CUSTOM_ELEMENT_METADATA] = metadata;
  };
}
