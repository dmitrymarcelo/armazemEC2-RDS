import { expect, test } from '@playwright/test';

test('login + compras + expedicao', async ({ page }) => {
  await page.goto('/');

  await page.getByPlaceholder('ex: admin@nortetech.com').fill('admin@nortetech.com');
  await page.getByPlaceholder('Digite sua senha').fill('admin');
  await page.getByRole('button', { name: /entrar no sistema/i }).click();

  await expect(page.getByText(/falha de conexao|not found/i)).toHaveCount(0);

  const comprasButton = page.getByRole('button', { name: /pedido de compras/i }).first();
  await expect(comprasButton).toBeVisible();
  await comprasButton.click();

  await expect(page.getByRole('main').getByRole('heading', { name: /pedidos de compra/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /nova requisi.*manual/i })).toBeVisible();

  const expedicaoButton = page.getByRole('button', { name: /solicita.*sa/i }).first();
  await expedicaoButton.click();
  await expect(page.getByRole('main').getByRole('heading', { name: /solicita.*sa/i })).toBeVisible();

  await page.getByRole('button', { name: /nova solicita/i }).click();
  await expect(page.getByRole('heading', { name: /requisi.*o de material/i })).toBeVisible();

  const modalForm = page.locator('form').last();
  await expect(modalForm).toBeVisible();

  const skuSelect = modalForm.locator('select').first();
  const skuOptions = await skuSelect.locator('option').count();

  if (skuOptions > 1) {
    let hasStockSku = false;

    for (let optionIndex = 1; optionIndex < skuOptions; optionIndex += 1) {
      await skuSelect.selectOption({ index: optionIndex });

      const stockLabel = modalForm.getByText(/estoque dispon[ií]vel/i).first();
      await expect(stockLabel).toBeVisible();
      const stockText = (await stockLabel.textContent()) || '';
      const stockMatch = stockText.match(/(\d+)\s*un/i);
      const stockQty = stockMatch ? Number.parseInt(stockMatch[1], 10) : 0;

      if (stockQty > 0) {
        hasStockSku = true;
        break;
      }
    }

    if (hasStockSku) {
      await modalForm.locator('input[type="number"]').first().fill('1');
      await modalForm.getByPlaceholder('ABC-1234').fill('TEST-1234');
      await modalForm.locator('input[placeholder^="Ex:"]').fill('Teste E2E');

      const submitButton = modalForm.getByRole('button', { name: /confirmar e iniciar workflow/i });
      await expect(submitButton).toBeEnabled();
      await submitButton.click();
    } else {
      await modalForm.getByRole('button', { name: /cancelar/i }).click();
    }
  } else {
    await modalForm.getByRole('button', { name: /cancelar/i }).click();
  }

  await expect(page.getByText(/fluxo interno|workflow|nenhuma solicitacao/i).first()).toBeVisible();
});
