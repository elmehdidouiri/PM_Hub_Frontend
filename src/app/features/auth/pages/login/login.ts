import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';

import { NotificationService } from '../../../../core/services/notification.service';
import { AuthService } from '../../../../core/services/auth';
import { finalize } from 'rxjs/operators';

interface LanguageItem {
  code: string;
  name: string;
}

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  standalone: false,
  host: {
    ngSkipHydration: 'true',
  },
})
export class Login implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  hidePassword = true;
  currYear: number = new Date().getFullYear();

  store = {
    locale: 'en',
    languageList: [
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'Français' },
      { code: 'es', name: 'Español' },
    ] as LanguageItem[],
  };

  translate = {
    currentLang: this.store.locale,
  };

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    public router: Router,
    private route: ActivatedRoute,
    private notificationService: NotificationService
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';

    if (this.authService.isAuthenticated()) {
      this.router.navigateByUrl(returnUrl);
      return;
    }
  }

  private initForm(): void {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.loginForm.disable({ emitEvent: false });

    this.authService.login(this.loginForm.value).pipe(
      finalize(() => {
        // Avoid NG0100 when request resolves synchronously in dev mode.
        setTimeout(() => {
          this.isLoading = false;
          this.loginForm.enable({ emitEvent: false });
        });
      })
    ).subscribe({
      next: (user) => {
        this.notificationService.showSuccess(`Bienvenue ${user.firstName} !`);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: () => {
      },
    });
  }

  changeLanguage(item: LanguageItem): void {
    this.store.locale = item.code;
    this.translate.currentLang = item.code;
  }

  getErrorMessage(field: string): string {
    const control = this.loginForm.get(field);

    if (control?.hasError('required')) {
      return 'Ce champ est obligatoire';
    }
    if (control?.hasError('email')) {
      return 'Email invalide';
    }
    if (control?.hasError('minlength')) {
      return 'Minimum 6 caractères';
    }

    return '';
  }
}
