// balance.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Represents the available time-off balance for an employee at a specific location.
 * Ensures each employee-location combination has a single balance record.
 */
@Entity('balances')
@Unique(['employeeId', 'locationId'])
export class Balance {
  /**
   * Unique identifier for the balance record.
   * Generated as a UUID primary key.
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Identifier of the employee whose balance is tracked.
   */
  @Column({ type: 'text', nullable: false })
  employeeId: string;

  /**
   * Identifier of the location associated with the balance.
   */
  @Column({ type: 'text', nullable: false })
  locationId: string;

  /**
   * Number of available time-off days.
   * Defaults to 0. Stored as a decimal with 2 decimal places.
   */
  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, nullable: false })
  availableDays: number;

  /**
   * Date when this balance was last synchronized with an external HR system.
   * Can be null if never synced.
   */
  @Column({ type: 'datetime', nullable: true })
  lastSyncedAt: Date | null;

  /**
   * Timestamp when the balance record was created.
   * Automatically set by TypeORM.
   */
  @CreateDateColumn({ type: 'datetime' })
  createdAt: Date;

  /**
   * Timestamp when the balance record was last updated.
   * Automatically updated by TypeORM.
   */
  @UpdateDateColumn({ type: 'datetime' })
  updatedAt: Date;
}