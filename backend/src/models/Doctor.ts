import { Schema, model, Document, Types } from 'mongoose'
export interface IDoctor extends Document {
  name: string
  email: string
  passwordHash: string
  specialty?: string
  hospitalId: Types.ObjectId
  refreshTokenHash?: string
  refreshTokenExpiresAt?: Date
  createdAt: Date
  updatedAt: Date
}
const DoctorSchema = new Schema<IDoctor>(
  {
    name:                  { type: String, required: true },
    email:                 { type: String, required: true, unique: true, lowercase: true },
    passwordHash:          { type: String, required: true },
    specialty:             String,
    hospitalId:            { type: Schema.Types.ObjectId, ref: 'Hospital', required: true },
    refreshTokenHash:      String,
    refreshTokenExpiresAt: Date,
  },
  { timestamps: true }
)
DoctorSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    delete ret.passwordHash
    delete ret.refreshTokenHash
    delete ret.refreshTokenExpiresAt
    return ret
  },
})
export const Doctor = model<IDoctor>('Doctor', DoctorSchema)
