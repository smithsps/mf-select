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
  ChangeDetectorRef,
  ChangeDetectionStrategy,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  AfterViewInit,
  ViewEncapsulation,
  OnChanges,
  SimpleChanges,
  TemplateRef,
  HostBinding,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { VirtualScrollComponent } from 'angular2-virtual-scroll';

export type MfSelectItem = string | object;

export interface MfCategory {
  categoryName: string;
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
  @Input() public categoryLabel?: string;
  @Input() public dropdownPosition: 'bottom' | 'top' | 'auto' = 'auto';
  @Input() public dropdownWidth: number;
  @Input() public appendTo: string;
  @Input() public placeholder: string = 'Select...';

  @Output() public update: EventEmitter<MfSelectItem> = new EventEmitter<MfSelectItem>();

  @ViewChild('dropdownPanel') private dropdownPanel: ElementRef;
  @ViewChild('searchInput')  private searchInput: ElementRef;
  @ViewChild(VirtualScrollComponent) private virtualScrollComponent: VirtualScrollComponent;

  @Input() public searchTemplateLeft: TemplateRef<any>;
  @Input() public searchTemplateRight: TemplateRef<any>;
  @Input() public selectedTemplate: TemplateRef<any>;
  @Input() public optionTemplate: TemplateRef<any>;
  @Input() public optionCategoryTemplate: TemplateRef<any>;



  public searchTerm: string = '';
  public filteredItems: MfSelectItem[] = [];
  public currentDropdownPosition: 'bottom' | 'top' | 'auto';
  public viewPortItems: MfSelectItem[] = [];

  @HostBinding('class') public parentClass = 'mf-select';
  @HostBinding('class.open') public isOpen: boolean = false;
  @HostBinding('class.disabled') public isDisabled: boolean = false;

  public get selectedItem() {
    return this.model;
  }
  private model: MfSelectItem = null;
  private _markedItem: number = 0;
  private set markedItem(val: number) {
    val = this.findNextNonCategoryItem(val);
    this._markedItem = Math.max(val, 0);
  }
  private get markedItem(): number {
    return this._markedItem;
  }


  private onChange = (_: MfSelectItem) => { };
  private onTouched = () => { };

  constructor(
    private changeDetectorRef: ChangeDetectorRef,
    private elementRef: ElementRef
  ) {
  }

  public ngOnInit(): void {
    this.filteredItems = this.items || [];
    this.filteredItems = this.processCategories();
  }

  public ngAfterViewInit(): void {
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

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes.dropdownPosition) {
      this.currentDropdownPosition = changes.dropdownPosition.currentValue;
    }

    if (changes.items) {
      this.items = changes.items.currentValue;

      // Update filteredItems
      this.onSearch(this.searchTerm);

      if (this.isMfCategory(this.filteredItems[this.markedItem])) {
        this.markedItem += 1;
      }
    }
  }

  public ngOnDestroy(): void {
    this.changeDetectorRef.detach();
    if (this.appendTo) {
      this.elementRef.nativeElement.appendChild(this.dropdownPanel.nativeElement);
    }
  }

  // Only works when search input is focused
  public onKeydown($event: KeyboardEvent): void {
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
          // Also skip over any categories when moving upward
          this.markedItem += this.isMfCategory(this.filteredItems[this.markedItem - 1]) ? -2 : -1;
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
          // console.log('backspace');
          // this._handleBackspace();
          break;
      }
    }
  }

  public toggle(): void {
    this.isOpen ? this.close() : this.open();
  }

  public open(): void {
    if (this.isDisabled || this.isOpen) { return; }

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

  public close(): void {
    if (this.isDisabled || !this.isOpen) {
      return;
    }

    this.isOpen = false;
  }

  public onSearch(search: string): void {
    this.searchTerm = search;
    this.filteredItems = search ? this.items.filter((item: MfSelectItem) => {
      const value: string = this.getLabel(item);
      return !this.isMfCategory(item) && value.toUpperCase().indexOf(search.toUpperCase()) > -1;
    }) : this.items || [];

    this.filteredItems = this.processCategories();

    // If the marker would be outside the bounds, reset it.
    if (this.markedItem >= this.filteredItems.length) {
      this.markedItem = 0;
    }

    // Refresh virtual scroll to reflect filtered items
    this.virtualScrollComponent.refresh();
  }

  public selectItem(item: MfSelectItem): void {
    if (this.isDisabled || this.isMfCategory(item)) { return; }
    this.updateNgModel(item);
    this.markedItem = this.filteredItems.indexOf(this.model);
    this.onChange(this.model);
    this.close();
  }

  public getLabel(item: MfSelectItem): string {
    if (!item) { return null; }
    return typeof item === 'string' ? item : (item[this.itemLabel] || item.toString());
  }









  /**
   * ControlValueAccessor Methods
   */
  public writeValue(value: MfSelectItem): void {
    this.updateNgModel(value);
    this.markedItem = this.filteredItems.indexOf(this.model);

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


  private updateNgModel(value: MfSelectItem): void {
    this.model = value;
    this.update.emit(this.model);
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


  private autoPositionDropdown(): void {
    const selectRect = this.elementRef.nativeElement.getBoundingClientRect();
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    const offsetTop = selectRect.top + window.pageYOffset;
    const height = selectRect.height;
    const dropdownPanel = this.getDropdownMenu();
    if (!dropdownPanel) { return; }
    const dropdownHeight = dropdownPanel.getBoundingClientRect().height;

    if (offsetTop + height + dropdownHeight > scrollTop + document.documentElement.clientHeight) {
      this.currentDropdownPosition = 'top';
    } else {
      this.currentDropdownPosition = 'bottom';
    }
  }

  private updateAppendedDropdownPosition(): void {
    const select: HTMLElement = this.elementRef.nativeElement;
    const dropdownPanel = this.getDropdownMenu();
    if (!dropdownPanel) { return; }
    const parentRect = dropdownPanel.parentElement.getBoundingClientRect();
    const selectRect = select.getBoundingClientRect();
    const offsetTop = selectRect.top - parentRect.top;
    const offsetLeft = selectRect.left - parentRect.left;
    const topDelta = this.currentDropdownPosition === 'top' ? -(dropdownPanel.getBoundingClientRect().height + 6) : selectRect.height;
    // console.log(parentRect, selectRect, offsetTop, offsetLeft, topDelta);
    dropdownPanel.style.top = offsetTop + topDelta + 'px';
    dropdownPanel.style.bottom = 'auto';
    dropdownPanel.style.left = offsetLeft + 'px';
    if (!this.dropdownWidth) {
      dropdownPanel.style.width = selectRect.width + 'px';
    }
  }

  private processCategories(): MfSelectItem[] {
    if (this.categoryLabel === undefined) { return this.filteredItems; }

    const categorySet: Set<string> = new Set([]);
    for (const item of this.filteredItems) {
      categorySet.add(item[this.categoryLabel]);
    }

    const categories = Array.from(categorySet.values()).sort();

    const itemsWithCategories: MfSelectItem[] = [];
    for (const category of categories) {
      itemsWithCategories.push({ categoryName: category });

      for (const item of this.filteredItems) {
        if (item[this.categoryLabel] === category) {
          itemsWithCategories.push(item);
        }
      }
    }

    return itemsWithCategories;
  }

  private isMfCategory(item: MfSelectItem): item is MfCategory {
    return item && (<MfCategory> item).categoryName !== undefined;
  }

  private findNextNonCategoryItem(pos: number): number {
    pos = pos >= 0 ? pos : 0;

    while (this.isMfCategory(this.filteredItems[pos])) {
      pos += 1;

      // Off the edge of the map, here be.. Nevermind lets just turn around.
      // Should be non-reachable
      if (pos > this.filteredItems.length) {
        return 0;
      }
    }

    return pos;
  }
}
