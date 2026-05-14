import { Component } from '@angular/core';
import { SupabaseService, Transaction } from '../services/supabase.service';
import { LoadingController, ActionSheetController, AlertController } from '@ionic/angular';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: false,
})
export class DashboardPage {
  period: 'today' | 'week' | 'month' | 'custom' = 'today';
  
  // Custom date range bounds
  customStart: string = new Date().toISOString();
  customEnd: string = new Date().toISOString();

  transactions: Transaction[] = [];
  
  totalIngresos = 0;
  totalEgresos = 0;
  gananciaNeta = 0;

  paymentMethodStats = {
    efectivo: { amount: 0, percentage: 0, count: 0 },
    tarjeta: { amount: 0, percentage: 0, count: 0 },
    transferencia: { amount: 0, percentage: 0, count: 0 },
  };

  private realtimeChannel: any;

  constructor(
    private supabase: SupabaseService,
    private loadingCtrl: LoadingController,
    private actionSheetCtrl: ActionSheetController,
    private alertCtrl: AlertController
  ) {}

  ionViewWillEnter() {
    this.loadData();
    // Subscribe to realtime changes
    this.realtimeChannel = this.supabase.subscribeToTransactions(() => {
      // Reload data silently when a change occurs from any client
      this.loadDataSilently();
    });
  }

  ionViewWillLeave() {
    if (this.realtimeChannel) {
      this.realtimeChannel.unsubscribe();
    }
  }

  async loadData() {
    const loading = await this.loadingCtrl.create({ message: 'Cargando...', spinner: 'crescent' });
    await loading.present();

    try {
      const { start, end } = this.getDateRange(this.period);
      this.transactions = await this.supabase.getTransactions(start, end);
      this.calculateStats();
    } catch (error) {
      console.error(error);
    } finally {
      loading.dismiss();
    }
  }

  async loadDataSilently() {
    try {
      const { start, end } = this.getDateRange(this.period);
      this.transactions = await this.supabase.getTransactions(start, end);
      this.calculateStats();
    } catch (error) {
      console.error('Error in realtime update:', error);
    }
  }

  onPeriodChange(event: any) {
    this.period = event.detail.value;
    if (this.period !== 'custom') {
      this.loadData();
    }
  }

  onCustomDateChange() {
    if (this.period === 'custom') {
      this.loadData();
    }
  }

  async openTransactionOptions(transaction: Transaction) {
    if (!transaction.id) return;
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Opciones de Transacción',
      buttons: [
        {
          text: 'Editar monto',
          icon: 'pencil',
          handler: () => {
            this.showEditAlert(transaction);
          }
        },
        {
          text: 'Eliminar',
          icon: 'trash',
          role: 'destructive',
          handler: () => {
            this.showDeleteConfirm(transaction);
          }
        },
        {
          text: 'Cancelar',
          icon: 'close',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async showEditAlert(transaction: Transaction) {
    const alert = await this.alertCtrl.create({
      header: 'Editar Monto',
      inputs: [
        {
          name: 'amount',
          type: 'number',
          value: transaction.amount,
          placeholder: 'Monto'
        }
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: async (data) => {
            if (data.amount && data.amount > 0) {
              const loading = await this.loadingCtrl.create({ message: 'Actualizando...' });
              await loading.present();
              try {
                await this.supabase.updateTransactionAmount(transaction.id!, data.amount);
                this.loadData();
              } catch (e) {
                console.error(e);
              } finally {
                loading.dismiss();
              }
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async showDeleteConfirm(transaction: Transaction) {
    const alert = await this.alertCtrl.create({
      header: '¿Eliminar Transacción?',
      message: 'Esta acción no se puede deshacer y los números se ajustarán automáticamente.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Eliminando...' });
            await loading.present();
            try {
              await this.supabase.deleteTransaction(transaction.id!);
              this.loadData();
            } catch (e) {
              console.error(e);
            } finally {
              loading.dismiss();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  calculateStats() {
    this.totalIngresos = 0;
    this.totalEgresos = 0;
    
    let statsPorMetodo = { 
      efectivo: { amount: 0, count: 0 }, 
      tarjeta: { amount: 0, count: 0 }, 
      transferencia: { amount: 0, count: 0 } 
    };

    this.transactions.forEach(t => {
      if (t.type === 'ingreso') {
        this.totalIngresos += t.amount;
        statsPorMetodo[t.payment_method].amount += t.amount;
        statsPorMetodo[t.payment_method].count += 1;
      } else {
        this.totalEgresos += t.amount;
      }
    });

    this.gananciaNeta = this.totalIngresos - this.totalEgresos;

    const calcPercentage = (amount: number) => this.totalIngresos > 0 ? (amount / this.totalIngresos) * 100 : 0;

    this.paymentMethodStats = {
      efectivo: { amount: statsPorMetodo.efectivo.amount, percentage: calcPercentage(statsPorMetodo.efectivo.amount), count: statsPorMetodo.efectivo.count },
      tarjeta: { amount: statsPorMetodo.tarjeta.amount, percentage: calcPercentage(statsPorMetodo.tarjeta.amount), count: statsPorMetodo.tarjeta.count },
      transferencia: { amount: statsPorMetodo.transferencia.amount, percentage: calcPercentage(statsPorMetodo.transferencia.amount), count: statsPorMetodo.transferencia.count },
    };
  }

  private getDateRange(period: string): { start: string, end: string } {
    if (period === 'custom') {
      // Ensure time includes the entire end day
      const start = new Date(this.customStart);
      start.setHours(0, 0, 0, 0);
      const end = new Date(this.customEnd);
      end.setHours(23, 59, 59, 999);
      return { start: start.toISOString(), end: end.toISOString() };
    }

    const now = new Date();
    let start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    if (period === 'week') {
      const day = start.getDay() || 7;
      if (day !== 1) start.setHours(-24 * (day - 1));
    } else if (period === 'month') {
      start.setDate(1);
    }

    return { start: start.toISOString(), end: end.toISOString() };
  }
}
