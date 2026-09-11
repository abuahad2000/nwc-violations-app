import {it,expect} from 'vitest';
import ExcelJS from 'exceljs';
import {exportViolationsWorkbook,googleMapsURL} from '@/lib/reports/excel';
it('writes clickable coordinates, RTL styling and literal untrusted text',async()=>{
 const buffer=await exportViolationsWorkbook([{'رقم البلاغ':'001','خط العرض':24.7,'خط الطول':46.6,'وصف التعدي':'=HYPERLINK("bad")'},{'رقم البلاغ':'002','خط العرض':null,'خط الطول':46.6,'وصف التعدي':'وصف'}]);
 const book=new ExcelJS.Workbook();await book.xlsx.load(new Uint8Array(buffer).buffer);const sheet=book.worksheets[0];
 expect(sheet.views[0].rightToLeft).toBe(true);expect(sheet.getCell('A1').font.name).toBe('Sakkal Majalla');expect(sheet.getCell('A2').font.name).toBe('Sakkal Majalla');
 expect(sheet.getCell('E2').value).toMatchObject({hyperlink:'https://www.google.com/maps/search/?api=1&query=24.7%2C46.6'});
 expect(sheet.getCell('E3').value).toBe('إحداثيات غير متاحة');expect(sheet.getCell('D2').formula).toBeUndefined();expect(sheet.rowCount).toBe(3);
 expect(googleMapsURL(91,46)).toBeNull();expect(googleMapsURL('',46)).toBeNull();expect(googleMapsURL(0,0)).toBeNull();
});

