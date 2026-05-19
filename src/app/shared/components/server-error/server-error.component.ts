import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-server-error',
  standalone: true,
  imports: [CommonModule, HttpClientModule, MatIconModule, MatButtonModule],
  templateUrl: './server-error.component.html',
  styleUrls: ['./server-error.component.scss']
})
export class ServerErrorComponent implements OnInit {
  isChecking = false;
  showErrorMsg = false;
  errorText = "Le serveur de base de données ou l'API ne répond pas (Code: 500 - ECONNREFUSED).";

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Automatically trigger a check in case it was a temporary glitch
    this.checkConnection(true);
  }

  retry(): void {
    this.checkConnection(false);
  }

  private checkConnection(silent = false): void {
    if (this.isChecking) return;
    this.isChecking = true;
    this.showErrorMsg = false;

    // Ping the backend departments endpoint to see if it's back online
    this.http.get('/api/departments', { 
      observe: 'response',
      headers: { 'X-Ignore-Error-Interceptor': 'true' }
    }).subscribe({
      next: () => {
        this.isChecking = false;
        // Success! Connection restored, go back to dashboard/home
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isChecking = false;
        // If status is not 0 (meaning we got a real response from the backend, even if it's 401 Unauthorized), the server IS up!
        if (err.status !== 0 && err.status !== 504 && err.status !== 500 && err.status !== 502) {
          this.router.navigate(['/']);
        } else {
          if (!silent) {
            this.showErrorMsg = true;
            // Play a slight shake/vibration animation on screen or audio
            setTimeout(() => {
              this.showErrorMsg = false;
            }, 3000);
          }
        }
      }
    });
  }
}
