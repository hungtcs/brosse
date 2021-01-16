import { Attribute, BaseHTMLElement, CustomElement } from "./core.js";

@CustomElement({
  selector: 'cicara-resizeable-container',
  shadowDOM: true,
  templateURL: 'assets/templates/resizeable-container.element.html',
})
export class CicaraResizeableContainerElement extends BaseHTMLElement {

  @Attribute('direction')
  public direction: 'right' = 'right';

  public element: HTMLElement = this;

  public onConnected() {
    console.log(this.element.innerHTML);

  }

}
