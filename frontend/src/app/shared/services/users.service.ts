import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  displayName: string;
  pace5kMinPerKm: number | null;
  pace10kMinPerKm: number | null;
  pace15kMinPerKm: number | null;
  paceHalfMarathonMinPerKm: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePacesDto {
  pace5kMinPerKm?: number;
  pace10kMinPerKm?: number;
  pace15kMinPerKm?: number;
  paceHalfMarathonMinPerKm?: number;
}

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`);
  }

  updatePaces(data: UpdatePacesDto): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/me/paces`, data);
  }
}
