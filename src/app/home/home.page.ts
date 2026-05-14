import { Component } from '@angular/core';
import { ToastController, LoadingController } from '@ionic/angular';
import { SupabaseService, Transaction } from '../services/supabase.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage {
  amount: string = '0';
  transactionType: 'ingreso' | 'egreso' = 'ingreso';

  constructor(
    private supabase: SupabaseService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private router: Router
  ) {}

  appendNumber(num: string) {
    if (this.amount === '0') {
      this.amount = num;
    } else {
      this.amount += num;
    }
  }

  deleteNumber() {
    if (this.amount.length > 1) {
      this.amount = this.amount.slice(0, -1);
    } else {
      this.amount = '0';
    }
  }

  clearAmount() {
    this.amount = '0';
  }

  setTransactionType(type: 'ingreso' | 'egreso') {
    this.transactionType = type;
  }

  async processPayment(method: 'efectivo' | 'tarjeta' | 'transferencia') {
    const numericAmount = parseFloat(this.amount);
    if (numericAmount <= 0) {
      this.showToast('El monto debe ser mayor a 0', 'warning');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Guardando...',
    });
    await loading.present();

    try {
      const transaction: Transaction = {
        amount: numericAmount,
        type: this.transactionType,
        payment_method: method
      };

      await this.supabase.addTransaction(transaction);
      
      this.showToast('Transacción guardada con éxito', 'success');
      this.clearAmount();
    } catch (error) {
      console.error(error);
      this.showToast('Error al guardar la transacción', 'danger');
    } finally {
      loading.dismiss();
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'top'
    });
    toast.present();
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
