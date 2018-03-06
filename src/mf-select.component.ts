/**
 * Heavily based on the great project over at https://github.com/ng-select/ng-select
 * @author Adam Keenan <adam.keenan@myfarms.com>
 */

import {
  Component,
  ViewChild,
  ElementRef,
  forwardRef,
  OnInit,
  Renderer2,
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  HostListener,
  AfterViewInit,
  ViewEncapsulation,
  OnChanges,
  SimpleChanges,
  // ContentChild,
  TemplateRef,
  ViewRef,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { VirtualScrollComponent } from 'angular2-virtual-scroll';

export type MfSelectItem = string | object;

@Component({
  selector: 'mf-select',
  templateUrl: './mf-select.component.html',
  styleUrls: ['./mf-select.component.scss'],
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => MfSelectComponent),
    multi: true,
  }],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MfSelectComponent implements OnInit, AfterViewInit, OnChanges, OnDestroy, ControlValueAccessor {


  @Input() public items: MfSelectItem[] = [];
  @Input() public itemLabel: string = 'name';
  @Input() public dropdownPosition: 'bottom' | 'top' | 'auto';
  @Input() public dropdownWidth: number;
  @Input() public appendTo: string;
  @Input() public enableAddAction: boolean = false;

  @Output() public addAction: EventEmitter<string> = new EventEmitter<string>();
  @Output() public change: EventEmitter<MfSelectItem> = new EventEmitter<MfSelectItem>();

  @ViewChild('dropdownPanel') private dropdownPanel: ElementRef;
  @ViewChild('searchInput')  private searchInput: ElementRef;
  @ViewChild(VirtualScrollComponent) private virtualScrollComponent: VirtualScrollComponent;

  // @ContentChild('searchTemplate') private searchTemplate: TemplateRef<any>;


  public isOpen: boolean = false;
  public isDisabled: boolean = false;
  public searchTerm: string = '';
  public filteredItems: MfSelectItem[] = [];
  public currentDropdownPosition: 'bottom' | 'top' | 'auto' = 'bottom';

  private model: MfSelectItem = null;
  private _markedItem: number = 0;
  private set markedItem(val: number) {
    this._markedItem = Math.max(val, 0);
  }
  private get markedItem(): number {
    return this._markedItem;
  }


  private onChange = (_: MfSelectItem) => { };
  private onTouched = () => { };

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private elementRef: ElementRef,
    private renderer: Renderer2
  ) {
  }

  public ngOnInit() {
    this.filteredItems = this.items || [];
  }

  public ngAfterViewInit() {
    if (this.appendTo) {
      const parent = document.querySelector(this.appendTo);
      if (!parent) {
        throw new Error(`appendTo selector ${this.appendTo} did not found any parent element`)
      }
      parent.appendChild(this.dropdownPanel.nativeElement);
      // this._handleDocumentResize();
      this.updateAppendedDropdownPosition();
    }
  }

  public ngOnChanges(changes: SimpleChanges) {
    if (changes.dropdownPosition) {
      this.currentDropdownPosition = changes.dropdownPosition.currentValue;
    }

    if (changes.items) {
      this.items = changes.items.currentValue;

      // Update filteredItems
      this.onSearch(this.searchTerm);
    }
  }

  public ngOnDestroy() {
    this.changeDetectorRef.detach();
    if (this.appendTo) {
      this.elementRef.nativeElement.appendChild(this.dropdownPanel.nativeElement);
    }
  }

  // Only works when search input is focused
  @HostListener('keydown', ['$event'])
  public handleKeyDown($event: KeyboardEvent) {
    // console.log('handleKeyDown', $event.which);
    if (KeyCode[$event.which]) {
      switch ($event.which) {
        case KeyCode.ArrowDown:
          this.open();
          this.markedItem = this.markedItem < this.filteredItems.length - 1 ? this.markedItem + 1 : this.markedItem;
          this.virtualScrollComponent.scrollInto(this.filteredItems[this.markedItem]);
          $event.preventDefault();
          break;
        case KeyCode.ArrowUp:
          this.markedItem = this.markedItem > 0 ? this.markedItem - 1 : 0;
          this.virtualScrollComponent.scrollInto(this.filteredItems[this.markedItem]);
          $event.preventDefault();
          break;
        case KeyCode.Space:
          // this._handleSpace($event);
          break;
        case KeyCode.Enter:
          this.selectItem(this.filteredItems[this.markedItem]);
          break;
        case KeyCode.Tab:
          // this._handleTab($event);
          break;
        case KeyCode.Backspace:
          console.log('backspace');
          // this._handleBackspace();
          break;
      }
    }
  }

  public toggle() {
    this.isOpen ? this.close() : this.open();
  }

  public open() {
    this.isOpen = true;

    // Focus search and select all text
    setTimeout(() => {
      this.searchInput.nativeElement.focus();
      this.searchInput.nativeElement.select();
    });

    if (this.dropdownPosition === 'auto') {
      this.autoPositionDropdown();
    }
    if (this.appendTo) {
      this.updateAppendedDropdownPosition();
    }
  }

  public close() {
    if (!this.isOpen) {
      return;
    }

    this.isOpen = false;
  }

  public onSearch(search: string) {
    this.searchTerm = search;
    this.filteredItems = search ? this.items.filter((item: MfSelectItem) => {
      const value: string = typeof item === 'string' ? item : item[this.itemLabel];
      return value.toUpperCase().indexOf(search.toUpperCase()) > -1;
    }) : this.items || [];

    // If the marker would be outside the bounds, reset it.
    if (this.markedItem >= this.filteredItems.length) {
      this.markedItem = 0;
    }

    // Refresh virtual scroll to reflect filtered items
    this.virtualScrollComponent.refresh();
  }

  public selectItem(item: MfSelectItem) {
    this.updateNgModel(item);
    this.markedItem = this.filteredItems.indexOf(this.model);
    this.onChange(this.model);
    this.close();
  }

  public getLabel(item: MfSelectItem) {
    if (!item) { return null; }
    return typeof item === 'string' ? item : item[this.itemLabel];
  }

  public onAddAction() {
    this.addAction.emit(this.searchTerm);
  }









  /**
   * ControlValueAccessor Methods
   */
  public writeValue(value: MfSelectItem): void {
    this.selectItem(value);

    if (!(<any>this.changeDetectorRef).destroyed) {
      this.changeDetectorRef.detectChanges();
    }
  }

  public registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  public registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  public setDisabledState(isDisabled: boolean): void {
    this.isDisabled = isDisabled;
  }


  private updateNgModel(value: MfSelectItem) {
    this.model = value;
    this.change.emit(this.model);
  }


  /**
   * Positioning Methods
   */

  private getDropdownMenu(): HTMLElement {
    if (!this.isOpen /*|| !this.dropdownList*/) {
      return null;
    }

    return <HTMLElement>this.dropdownPanel.nativeElement;
  }


  private autoPositionDropdown() {
    const selectRect = this.elementRef.nativeElement.getBoundingClientRect();
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const offsetTop = selectRect.top + window.pageYOffset;
    const height = selectRect.height;
    const dropdownHeight = this.dropdownPanel.nativeElement.getBoundingClientRect().height;

    if (offsetTop + height + dropdownHeight > scrollTop + document.documentElement.clientHeight) {
      this.currentDropdownPosition = 'top';
    } else {
      this.currentDropdownPosition = 'bottom';
    }
  }

  private updateAppendedDropdownPosition() {
    const select: HTMLElement = this.elementRef.nativeElement;
    const dropdownPanel: HTMLElement = this.dropdownPanel.nativeElement;
    const parentRect = dropdownPanel.parentElement.getBoundingClientRect();
    const selectRect = select.getBoundingClientRect();
    const offsetTop = selectRect.top - parentRect.top;
    const offsetLeft = selectRect.left - parentRect.left;
    const topDelta = this.currentDropdownPosition === 'bottom' ? selectRect.height : -(dropdownPanel.getBoundingClientRect().height + 6);
    // console.log(parentRect, selectRect, offsetTop, offsetLeft, topDelta);
    dropdownPanel.style.top = offsetTop + topDelta + 'px';
    dropdownPanel.style.bottom = 'auto';
    dropdownPanel.style.left = offsetLeft + 'px';
    dropdownPanel.style.width = selectRect.width + 'px';
  }
}

export enum KeyCode {
  Tab = 9,
  Enter = 13,
  Esc = 27,
  Space = 32,
  ArrowUp = 38,
  ArrowDown = 40,
  Backspace = 8
}
