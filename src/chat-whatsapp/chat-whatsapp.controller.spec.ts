import { Test, TestingModule } from '@nestjs/testing';
import { ChatWhatsappController } from './chat-whatsapp.controller';

describe('ChatWhatsappController', () => {
  let controller: ChatWhatsappController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ChatWhatsappController],
    }).compile();

    controller = module.get<ChatWhatsappController>(ChatWhatsappController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
