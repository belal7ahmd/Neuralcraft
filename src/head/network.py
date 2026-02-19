from torch import optim
from torch import nn
import torch


class AI(nn.Module):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.layers = nn.Sequential(
            nn.Linear(175, 256),
            nn.LeakyReLU(),
            nn.Linear(256, 128),
            nn.LeakyReLU(),
            nn.Linear(128, 128),
            nn.LeakyReLU(),
            nn.Linear(128, 128),
            nn.LeakyReLU(),
            nn.Linear(128, 12)
        )

        self.loss = nn.MSELoss()

        self.optim = optim.Adam(self.parameters(), 0.0001)

    def forward(self, x):
        # Pass through the main body
        x = self.layers(x) 
        
        # Split the 12 outputs
        # 0-8: Keyboard (Sigmoid for 0 to 1)
        keyboard = torch.sigmoid(x[:, :9])
        
        # 9: Interaction (Keep raw or round)
        interaction = x[:, 9:10]
        
        # 10-11: Mouse (Linear for negative/positive deltas)
        mouse = x[:, 10:] 
        
        return torch.cat((keyboard, interaction, mouse), dim=1)
    
    def backward_step(self, predicted_q, target_q):


        loss = self.loss(predicted_q, target_q)

        self.optim.zero_grad()
        loss.backward()

        torch.nn.utils.clip_grad_norm_(self.parameters(), max_norm=1.0)

        self.optim.step()