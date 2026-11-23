// DataTable organism - Reusable data table with consistent styling
// Based on DESIGN.md table specifications

import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TableSortLabel, Typography
} from '@mui/material';
import { radius } from '@shared/ui/tokens';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  numeric?: boolean;
  sortable?: boolean;
  width?: string | number;
  render?: (value: any, row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowsPerPage?: number;
  pagination?: {
    page: number;
    onPageChange: (page: number) => void;
  };
  emptyMessage?: string;
  loading?: boolean;
}

export function DataTable<T>({
  rows,
  columns,
  emptyMessage = 'No data available',
  loading = false,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <TableContainer component={Paper} sx={{ borderRadius: radius.md }}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                <Typography variant="body2" color="text.secondary">Loading...</Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  if (rows.length === 0) {
    return (
      <TableContainer component={Paper} sx={{ borderRadius: radius.md }}>
        <Table>
          <TableBody>
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                <Typography variant="body1" color="text.secondary">{emptyMessage}</Typography>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ borderRadius: radius.md }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell
                key={column.key as string}
               sx={{
                  fontWeight: 600,
                  backgroundColor: 'rgba(0,0,0,0.04)',
                }}
              >
                {column.sortable ? (
                  <TableSortLabel>{column.label}</TableSortLabel>
                ) : (
                  column.label
                )}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`row-${index}`} hover>
              {columns.map((column) => (
                <TableCell key={column.key as string}>
                  {column.render
                    ? column.render((row as any)[column.key], row)
                    : String((row as any)[column.key] ?? '-')
                  }
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}