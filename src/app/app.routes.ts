import { Routes } from '@angular/router';

import { LoginComponent } from './auth/components/login/login.component';
import { RegisterComponent } from './auth/components/register/register.component';
import { AdminComponent } from './auth/components/admin/admin.component';

import { BookComponent } from './crm/components/book/book.component';
import { BookingsTrackerComponent } from './crm/components/bookings-tracker/bookings-tracker.component';
import { CustomerRequestsComponent } from './crm/components/customer-requests/customer-requests.component';
import { CustomerServiceComponent } from './crm/components/customer-service/customer-service.component';
import { MyBookingsComponent } from './crm/components/my-bookings/my-bookings.component';
import { RequestStaffComponent } from './crm/components/request-staff/request-staff.component';

import { IotDevicesComponent } from './guest-experience/components/iot-devices/iot-devices.component';

import { ProfileComponent } from './profiles/components/profile/profile.component';
import { PreferencesComponent } from './profiles/components/preferences/preferences.component';

import { PageNotFoundComponent } from './public/pages/page-not-found/page-not-found.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'admin', component: AdminComponent },

  { path: 'book', component: BookComponent },
  { path: 'bookings-tracker', component: BookingsTrackerComponent },
  { path: 'customer-requests', component: CustomerRequestsComponent },
  { path: 'customer-service', component: CustomerServiceComponent },
  { path: 'my-bookings', component: MyBookingsComponent },
  { path: 'request-staff', component: RequestStaffComponent },

  { path: 'iot-devices', component: IotDevicesComponent },

  { path: 'profile', component: ProfileComponent },
  { path: 'preferences', component: PreferencesComponent },

  { path: '**', component: PageNotFoundComponent }
];
