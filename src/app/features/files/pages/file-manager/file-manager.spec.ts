import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FileManager } from './file-manager';

describe('FileManager', () => {
  let component: FileManager;
  let fixture: ComponentFixture<FileManager>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FileManager]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FileManager);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
